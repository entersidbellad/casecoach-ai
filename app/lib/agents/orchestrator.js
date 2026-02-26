// Orchestrator — runs the agent hierarchy for a student message
// This is the core engine that coordinates all agents

import { classifyIntent, containsPHI, routeToAgents } from './intent-classifier.js';
import { buildAgentPrompt, buildCaseContext } from './prompts.js';
import { callLLM } from './llm.js';

const AUTHORITY_LEVELS = {
    Employee: 1,
    CFO: 2,
    CMO: 2,
    ChiefMedicalOfficer: 2,
    CEO: 3
};

const AGENT_DISPLAY_NAMES = {
    Employee: 'Employee',
    CFO: 'CFO',
    CMO: 'CMO',
    ChiefMedicalOfficer: 'Chief Medical Officer',
    CEO: 'CEO'
};

export async function runHierarchy({ message, caseData, directives = [], agentOverrides = [] }) {
    const intent = classifyIntent(message);
    const phi = containsPHI(message);

    // PHI safety block
    if (phi) {
        return {
            intent,
            phi: true,
            agents_activated: ['Employee', 'ChiefMedicalOfficer'],
            agent_responses: [
                buildAgentResponse('Employee', 'Potential PHI/PII detected. Cannot proceed until data is anonymized.', 'do_not_proceed', 20, true),
                buildAgentResponse('ChiefMedicalOfficer', 'Blocked — contains protected health information. Please remove all identifying details and resubmit.', 'do_not_proceed', 10, true)
            ],
            final_recommendation: 'do_not_proceed',
            final_summary: 'We cannot continue because the message appears to include sensitive personal health information. Please anonymize and resubmit.',
            escalation_path: ['Employee → ChiefMedicalOfficer (PHI block)']
        };
    }

    // Determine which agents to activate
    const agentNames = routeToAgents(intent, message);
    const caseContext = buildCaseContext(caseData);
    const overrideMap = {};
    agentOverrides.forEach(o => { overrideMap[o.agent_name] = o.prompt_addition; });

    // Run all agents
    const agentResponses = [];
    const escalationPath = [];
    let previousResponses = '';

    for (const agentName of agentNames) {
        const prompt = buildAgentPrompt({
            agentName,
            caseContext,
            directives,
            override: overrideMap[agentName] || null
        });

        // For CEO, include previous agent responses for synthesis
        let userMsg = message;
        if (agentName === 'CEO' && previousResponses) {
            userMsg = `Student question: ${message}\n\n=== OTHER EXECUTIVE INPUTS ===\n${previousResponses}\n\nBased on these inputs, provide your executive decision.`;
        }

        const llmResult = await callLLM({ systemPrompt: prompt, userMessage: userMsg });

        // Parse recommendation signal from the response
        const signal = extractRecommendation(llmResult.content);
        const confidence = estimateConfidence(llmResult.content, agentName, intent);

        const resp = buildAgentResponse(
            agentName,
            llmResult.content,
            signal,
            confidence,
            signal === 'do_not_proceed' || signal === 'hold'
        );
        resp.model = llmResult.model;
        resp.tokens_used = llmResult.tokens_used;

        agentResponses.push(resp);

        // Track escalation path
        if (agentNames.indexOf(agentName) > 0) {
            const prev = agentNames[agentNames.indexOf(agentName) - 1];
            escalationPath.push(`${AGENT_DISPLAY_NAMES[prev]} → ${AGENT_DISPLAY_NAMES[agentName]}`);
        }

        // Build context for CEO
        if (agentName !== 'CEO') {
            previousResponses += `[${AGENT_DISPLAY_NAMES[agentName]}]: ${llmResult.content}\n\n`;
        }
    }

    // Resolve final recommendation from highest-authority agent
    const sorted = [...agentResponses].sort((a, b) => b.authority_level - a.authority_level);
    const topAgent = sorted[0];
    const finalRecommendation = topAgent?.recommendation || 'advisory';

    // Build student-facing summary
    const finalSummary = buildFinalSummary(finalRecommendation, agentResponses, intent);

    return {
        intent,
        phi: false,
        agents_activated: agentNames,
        agent_responses: agentResponses,
        final_recommendation: finalRecommendation,
        final_summary: finalSummary,
        escalation_path: escalationPath
    };
}


function buildAgentResponse(agentName, text, recommendation, confidence, escalate) {
    return {
        name: agentName,
        display_name: AGENT_DISPLAY_NAMES[agentName] || agentName,
        authority_level: AUTHORITY_LEVELS[agentName] || 1,
        text,
        recommendation, // proceed, hold, need_more_data, do_not_proceed
        confidence,
        escalate
    };
}

function extractRecommendation(text) {
    const lower = text.toLowerCase();
    if (/\b(do not proceed|block|blocked|cannot proceed)\b/.test(lower)) return 'do_not_proceed';
    if (/\b(proceed|approve|support|endorse|green light)\b/.test(lower)) return 'proceed';
    if (/\b(hold|wait|pause|defer|delay)\b/.test(lower)) return 'hold';
    if (/\b(need more data|more information|insufficient|clarify)\b/.test(lower)) return 'need_more_data';
    return 'advisory';
}

function estimateConfidence(text, agentName, intent) {
    // Simple heuristic for confidence scoring
    let base = 70;

    // Higher confidence if the agent is in its domain
    if (agentName === 'CFO' && intent === 'financial') base = 85;
    if (agentName === 'CMO' && intent === 'clinical') base = 85;
    if (agentName === 'ChiefMedicalOfficer' && (intent === 'clinical' || intent === 'compliance')) base = 88;
    if (agentName === 'CEO') base = 82;
    if (agentName === 'Employee' && intent === 'operational') base = 90;

    // Lower confidence if asking for more data
    if (/\b(uncertain|unclear|need more|insufficient)\b/i.test(text)) base -= 15;

    // Higher confidence if making a clear recommendation
    if (/\b(recommend|strongly suggest|I advise)\b/i.test(text)) base += 8;

    return Math.max(20, Math.min(98, base));
}

function buildFinalSummary(recommendation, agentResponses, intent) {
    const agentCount = agentResponses.length;

    switch (recommendation) {
        case 'do_not_proceed':
            return 'Safety or compliance concerns were identified. Please address the flagged issues before proceeding.';
        case 'proceed':
            return agentCount > 2
                ? 'The executive team supports this direction. Review their individual perspectives for important conditions and monitoring requirements.'
                : 'This approach has initial support. Review the team\'s input for conditions and next steps.';
        case 'hold':
            return 'The team recommends pausing to gather more evidence or address risks before committing to this direction.';
        case 'need_more_data':
            return 'Additional information is needed before a recommendation can be made. See each team member\'s specific requests.';
        default:
            return 'This is advisory guidance. Review the team\'s perspectives and formulate your own recommendation.';
    }
}

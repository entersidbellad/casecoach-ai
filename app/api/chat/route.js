// POST /api/chat — Main student chat endpoint with coaching pipeline
import { NextResponse } from 'next/server';
import { runHierarchy } from '@/app/lib/agents/orchestrator';
import {
    assessClarification,
    buildClarifyQuestions,
    evaluateReasoning,
    generateLLMCritique,
    determinePhase
} from '@/app/lib/agents/coaching';
import { containsPHI } from '@/app/lib/agents/intent-classifier';
import {
    getSessionById,
    getCreditsRemaining,
    incrementCredits,
    saveMessage,
    getAssignmentById,
    getActiveDirectives,
    getAgentOverrides,
    getMessagesBySession
} from '@/app/lib/db';
import * as dbModule from '@/app/lib/db';

export async function POST(request) {
    try {
        const body = await request.json();
        const { session_id, message } = body;

        if (!session_id) {
            return NextResponse.json({ error: 'session_id is required' }, { status: 400 });
        }
        if (!message || !message.trim()) {
            return NextResponse.json({ error: 'message is required' }, { status: 400 });
        }

        // Get session and check credits
        const session = getSessionById(session_id);
        if (!session) {
            return NextResponse.json({ error: 'Invalid session' }, { status: 404 });
        }

        const creditsRemaining = getCreditsRemaining(session_id);
        if (creditsRemaining <= 0) {
            return NextResponse.json({
                error: 'No credits remaining',
                credits_remaining: 0,
                message: 'You have used all your available turns for this assignment.'
            }, { status: 403 });
        }

        // Get assignment, case, directives, and overrides
        const assignment = getAssignmentById(session.assignment_id);
        if (!assignment) {
            return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
        }

        const caseData = dbModule.getCaseById(assignment.case_id);
        const directives = getActiveDirectives(assignment.id);
        const agentOverrides = caseData ? getAgentOverrides(caseData.id) : [];

        // Save student message
        saveMessage({
            session_id,
            role: 'student',
            content: message.trim()
        });

        // --- PHI safety check ---
        if (containsPHI(message)) {
            const phiResponse = {
                phase: 'safety',
                content: 'Your message appears to contain personal health information (PHI). Please remove any identifying details and resubmit with anonymized facts.',
                questions: ['Remove all identifying details and restate the problem using anonymized facts.'],
                agent_responses: [],
                credits_remaining: creditsRemaining - 1
            };
            saveMessage({
                session_id,
                role: 'system',
                content: phiResponse.content,
                phase: 'safety'
            });
            incrementCredits(session_id);
            return NextResponse.json(phiResponse);
        }

        // --- Determine coaching phase ---
        const existingMessages = getMessagesBySession(session_id);
        const currentPhase = determinePhase(existingMessages);

        // Phase 1: CLARIFY — Check if student has formed reasoning
        if (currentPhase === 'clarify') {
            const clarification = assessClarification(message.trim());

            if (!clarification.passed) {
                const questions = buildClarifyQuestions(message.trim());
                const response = {
                    phase: 'clarify',
                    content: `Before the executive team can analyze your question, I need to understand your reasoning. ${questions.join(' ')}`,
                    questions,
                    rubric: null,
                    agent_responses: [],
                    credits_remaining: creditsRemaining - 1,
                    coaching_hint: 'Start with "I recommend..." or "I think we should..." and include at least one reason why.'
                };
                saveMessage({
                    session_id,
                    role: 'system',
                    content: response.content,
                    phase: 'clarify'
                });
                incrementCredits(session_id);
                return NextResponse.json(response);
            }

            // Passed clarify gate — move to critique
            // Fall through to critique phase
        }

        // Phase 2: CRITIQUE — Evaluate reasoning quality
        if (currentPhase === 'clarify' || currentPhase === 'critique') {
            const critique = evaluateReasoning(message.trim(), caseData);

            if (!critique.sufficient) {
                // Generate LLM critique for richer feedback
                let llmCritique = '';
                try {
                    llmCritique = await generateLLMCritique(message.trim(), caseData, critique.rubric);
                } catch (e) {
                    llmCritique = '';
                }

                const response = {
                    phase: 'critique',
                    content: critique.feedback + (llmCritique ? `\n\n${llmCritique}` : ''),
                    questions: critique.missing,
                    rubric: {
                        problem_framing: scoreLabel(critique.rubric.problem_framing),
                        evidence_use: scoreLabel(critique.rubric.evidence_use),
                        tradeoff_quality: scoreLabel(critique.rubric.tradeoff_quality),
                        risk_compliance: scoreLabel(critique.rubric.risk_compliance)
                    },
                    agent_responses: [],
                    credits_remaining: creditsRemaining - 1,
                    coaching_hint: 'Strengthen the areas marked "Weak" or "Developing" in the rubric above.'
                };
                saveMessage({
                    session_id,
                    role: 'system',
                    content: response.content,
                    phase: 'critique'
                });
                incrementCredits(session_id);
                return NextResponse.json(response);
            }

            // Passed critique gate — fall through to direction
        }

        // Phase 3: DIRECTION — Unlock the full agent hierarchy
        const result = await runHierarchy({
            message: message.trim(),
            caseData,
            directives,
            agentOverrides
        });

        // Save system response with full trace
        saveMessage({
            session_id,
            role: 'system',
            content: result.final_summary,
            agent_trace: {
                intent: result.intent,
                phi: result.phi,
                agents_activated: result.agents_activated,
                agent_responses: result.agent_responses,
                final_recommendation: result.final_recommendation,
                escalation_path: result.escalation_path
            },
            phase: 'direction'
        });

        incrementCredits(session_id);

        return NextResponse.json({
            phase: 'direction',
            content: result.final_summary,
            intent: result.intent,
            agents_activated: result.agents_activated,
            agent_responses: result.agent_responses.map(r => ({
                name: r.name,
                display_name: r.display_name,
                authority_level: r.authority_level,
                text: r.text,
                recommendation: r.recommendation,
                confidence: r.confidence
            })),
            final_recommendation: result.final_recommendation,
            escalation_path: result.escalation_path,
            credits_remaining: creditsRemaining - 1,
            credits_warning: creditsRemaining - 1 <= 5 ? `${creditsRemaining - 1} turns remaining` : null
        });
    } catch (err) {
        console.error('Chat API error:', err);
        return NextResponse.json({ error: 'Internal server error', detail: err.message }, { status: 500 });
    }
}

function scoreLabel(score) {
    const labels = { 0: 'weak', 1: 'developing', 2: 'adequate', 3: 'strong' };
    return labels[score] || 'unknown';
}

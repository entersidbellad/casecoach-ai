// Coaching engine — Clarify → Critique → Direction pipeline
// Students must demonstrate reasoning before the executive hierarchy unlocks

import { callLLM } from './llm.js';

// ============================================================
// Phase 1: CLARIFY — Does the student have a formed opinion?
// ============================================================

export function assessClarification(message) {
    const lower = message.toLowerCase();

    const hasRationale =
        /\b(because|since|therefore|my reasoning|i think|i believe|my rationale|i recommend|my approach|i propose|i would|i suggest)\b/.test(lower);

    const hasRisk =
        /\b(risk|downside|concern|worry|problem|challenge|threat|limitation|drawback|issue)\b/.test(lower);

    const hasEvidence =
        /\b(\d+%|\$\d|\d+\s*(million|billion|m|b|k|bps|basis)|\bmlr\b|\broi\b|\bebitda\b|admissions|benchmark|data|evidence|study|metric)\b/i.test(lower);

    const wordCount = message.split(/\s+/).length;
    const hasSubstance = wordCount >= 20;

    return {
        has_rationale: hasRationale,
        has_risk: hasRisk,
        has_evidence: hasEvidence,
        has_substance: hasSubstance,
        passed: hasRationale && hasSubstance,
        score: [hasRationale, hasRisk, hasEvidence, hasSubstance].filter(Boolean).length
    };
}

export function buildClarifyQuestions(message) {
    const assessment = assessClarification(message);
    const questions = [];

    if (!assessment.has_rationale) {
        questions.push('What is your proposed approach? Start with "I recommend..." or "I think we should..."');
    }
    if (!assessment.has_risk) {
        questions.push('What is one key risk or concern with your recommendation?');
    }
    if (!assessment.has_evidence) {
        questions.push('Can you support your reasoning with a specific number from the case (e.g., MLR, budget, admissions)?');
    }
    if (!assessment.has_substance) {
        questions.push('Can you elaborate on your reasoning? Try to write at least 2-3 sentences.');
    }

    return questions.length > 0 ? questions : ['Tell me more about your reasoning.'];
}

// ============================================================
// Phase 2: CRITIQUE — Is the reasoning strong enough?
// ============================================================

export function evaluateReasoning(message, caseData) {
    const lower = message.toLowerCase();

    const rubric = {
        problem_framing: assessDimension(lower, [
            'problem', 'issue', 'challenge', 'question', 'decision', 'objective',
            'situation', 'context', 'background', 'currently', 'facing'
        ]),
        evidence_use: assessDimension(lower, [
            'data', 'evidence', 'study', 'report', 'number', 'statistic',
            'mlr', 'roi', 'ebitda', 'benchmark', 'metric', '%', '$', 'million', 'billion'
        ]),
        tradeoff_quality: assessDimension(lower, [
            'tradeoff', 'trade-off', 'however', 'on the other hand', 'versus', 'balanced',
            'advantage', 'disadvantage', 'pro', 'con', 'compare', 'alternatively', 'downside', 'upside'
        ]),
        risk_compliance: assessDimension(lower, [
            'risk', 'compliance', 'regulatory', 'legal', 'safety', 'cms', 'stars',
            'violation', 'penalty', 'audit', 'standard', 'requirement', 'patient safety'
        ])
    };

    const scores = Object.values(rubric);
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    const minScore = Math.min(...scores);

    const sufficient = avgScore >= 1.5 && minScore >= 1;

    const missing = [];
    if (rubric.problem_framing < 1.5) missing.push('Clearly define the problem or decision at hand');
    if (rubric.evidence_use < 1.5) missing.push('Support your argument with specific data from the case');
    if (rubric.tradeoff_quality < 1.5) missing.push('Discuss at least one tradeoff or counterargument');
    if (rubric.risk_compliance < 1.5) missing.push('Address compliance or risk considerations');

    return {
        rubric,
        sufficient,
        avg_score: avgScore,
        missing,
        feedback: buildCritiqueFeedback(rubric, sufficient)
    };
}

function assessDimension(text, keywords) {
    let hits = 0;
    for (const kw of keywords) {
        if (text.includes(kw)) hits++;
    }
    if (hits === 0) return 0;   // weak
    if (hits <= 2) return 1;    // developing
    if (hits <= 4) return 2;    // adequate
    return 3;                   // strong
}

function buildCritiqueFeedback(rubric, sufficient) {
    const labels = { 0: 'Weak', 1: 'Developing', 2: 'Adequate', 3: 'Strong' };
    const parts = [];

    for (const [dim, score] of Object.entries(rubric)) {
        const label = labels[score];
        const name = dim.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        parts.push(`**${name}**: ${label}`);
    }

    if (sufficient) {
        return `Your reasoning is strong enough to proceed. ${parts.join(' · ')}`;
    }
    return `Your reasoning needs strengthening before the executive team can weigh in. ${parts.join(' · ')}`;
}

// ============================================================
// Phase 3: DIRECTION — Use LLM for deeper critique if needed
// ============================================================

export async function generateLLMCritique(message, caseData, rubric) {
    const caseContext = caseData?.pdf_text
        ? `Case: ${caseData.title}\nKPIs: ${JSON.stringify(caseData.kpis)}\n`
        : '';

    const systemPrompt = `You are a Socratic business coach on the CaseCoach AI platform. Your job is to critique a student's reasoning and push them to think deeper. Be encouraging but rigorous.

${caseContext}
The student's current rubric scores are:
- Problem Framing: ${rubric.problem_framing}/3
- Evidence Use: ${rubric.evidence_use}/3
- Tradeoff Quality: ${rubric.tradeoff_quality}/3
- Risk & Compliance: ${rubric.risk_compliance}/3

Give exactly 2 specific, actionable questions that would improve their weakest areas. Be brief and direct.`;

    const result = await callLLM({
        systemPrompt,
        userMessage: `Here is the student's reasoning:\n\n${message}`
    });

    return result.content;
}

// ============================================================
// Coaching orchestrator — determines phase from session context
// ============================================================

export function determinePhase(messages) {
    if (!messages || messages.length === 0) return 'clarify';

    // Find the latest phase from messages
    const systemMessages = messages.filter(m => m.role === 'system' && m.phase);
    if (systemMessages.length === 0) return 'clarify';

    const latest = systemMessages[systemMessages.length - 1];

    if (latest.phase === 'direction') return 'direction'; // Already unlocked
    if (latest.phase === 'critique') return 'critique';     // In critique, check if they pass
    return 'clarify';
}

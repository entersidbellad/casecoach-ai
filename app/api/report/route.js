// POST /api/report — Generate a structured report scaffold from conversation history
import { NextResponse } from 'next/server';
import { getSessionById, getMessagesBySession, getAssignmentById, getCreditsRemaining, getCaseById } from '@/app/lib/db';
import { callLLM } from '@/app/lib/agents/llm';

export async function POST(request) {
    try {
        const { session_id } = await request.json();

        if (!session_id) {
            return NextResponse.json({ error: 'session_id is required' }, { status: 400 });
        }

        const session = await getSessionById(session_id);
        if (!session) {
            return NextResponse.json({ error: 'Session not found' }, { status: 404 });
        }

        const assignment = await getAssignmentById(session.assignment_id);
        const caseData = assignment ? await getCaseById(assignment.case_id) : null;
        const messages = await getMessagesBySession(session_id);

        // Extract conversation context
        const studentMessages = messages.filter(m => m.role === 'student').map(m => m.content);
        const systemMessages = messages.filter(m => m.role === 'system');
        const directionMessages = systemMessages.filter(m => m.phase === 'direction');

        // Gather agent traces
        const agentInsights = [];
        for (const msg of directionMessages) {
            if (msg.agent_trace) {
                const trace = typeof msg.agent_trace === 'string' ? JSON.parse(msg.agent_trace) : msg.agent_trace;
                if (trace.agent_responses) {
                    for (const agent of trace.agent_responses) {
                        agentInsights.push(`[${agent.display_name || agent.name}] (${agent.recommendation}, ${agent.confidence}%): ${agent.text}`);
                    }
                }
            }
        }

        // Build report with LLM if available
        const conversationSummary = studentMessages.join('\n---\n');
        const agentSummary = agentInsights.join('\n\n');

        const systemPrompt = `You are a report generator for the CaseCoach AI platform. Based on a student's conversation with the executive decision coaching system, generate a structured executive brief.

Format the report with these sections:
1. EXECUTIVE SUMMARY (2-3 sentences)
2. PROBLEM STATEMENT (what decision was being analyzed)
3. STUDENT'S RECOMMENDATION (what the student proposed)
4. EXECUTIVE TEAM ANALYSIS (key insights from each agent)
5. FINAL RECOMMENDATION (the consensus decision with rationale)
6. KEY RISKS & MITIGATIONS (top 3 risks identified)
7. IMPLEMENTATION TIMELINE (suggested next steps with milestones)
8. OPEN QUESTIONS (2-3 questions for further analysis)

Use professional, concise business language. Reference specific data points when available.
${caseData ? `\nCase: ${caseData.title}\nKPIs: ${JSON.stringify(caseData.kpis)}` : ''}`;

        const userMessage = `Student Discussion:
${conversationSummary}

Executive Agent Analysis:
${agentSummary || 'No executive analysis available yet.'}

Generate the structured report.`;

        let reportContent;
        try {
            const llmResult = await callLLM({ systemPrompt, userMessage });
            reportContent = llmResult.content;
        } catch (err) {
            // Fallback: generate a template report
            reportContent = generateFallbackReport(caseData, studentMessages, agentInsights);
        }

        return NextResponse.json({
            report: reportContent,
            metadata: {
                session_id,
                assignment: assignment?.title || 'Unknown',
                case_title: caseData?.title || 'Unknown',
                student_turns: studentMessages.length,
                agent_insights: agentInsights.length,
                credits_remaining: await getCreditsRemaining(session_id),
                generated_at: new Date().toISOString()
            }
        });
    } catch (err) {
        console.error('Report generation error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

function generateFallbackReport(caseData, studentMessages, agentInsights) {
    const title = caseData?.title || 'Case Analysis';
    return `# Executive Brief — ${title}

## 1. Executive Summary
This report summarizes the student's analysis of ${title} conducted through the CaseCoach AI Executive Decision Coach.

## 2. Problem Statement
${studentMessages.length > 0 ? studentMessages[0].substring(0, 200) + '...' : 'The student explored strategic decision-making scenarios related to the case.'}

## 3. Student's Recommendation
${studentMessages.length > 1 ? studentMessages[studentMessages.length - 1].substring(0, 300) : 'See conversation history for full reasoning.'}

## 4. Executive Team Analysis
${agentInsights.length > 0
            ? agentInsights.map(a => `- ${a}`).join('\n')
            : '- No executive team analysis available. Complete the Direction phase to generate insights.'
        }

## 5. Final Recommendation
Based on the analysis, the recommendation is pending further executive review.

## 6. Key Risks & Mitigations
1. **Financial Risk** — Ensure ROI analysis is complete before committing budget
2. **Operational Risk** — Phased implementation recommended to manage transition
3. **Stakeholder Risk** — Communication plan needed for all affected parties

## 7. Implementation Timeline
- **Week 1-2**: Detailed financial modeling and stakeholder mapping
- **Month 1**: Pilot program design and approval
- **Month 2-3**: Pilot execution with KPI monitoring
- **Month 4-6**: Evaluation and scale decision

## 8. Open Questions
1. What assumptions drive the financial projections?
2. How will success be measured at the 90-day mark?
3. What is the contingency plan if initial results fall short?

---
*Generated by CaseCoach AI — Executive Decision Coach*
*${new Date().toLocaleDateString()}*`;
}

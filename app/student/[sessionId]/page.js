'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useToast } from '@/app/components/Toast';

export default function StudentChat() {
    const { sessionId } = useParams();
    const router = useRouter();
    const toast = useToast();

    const [sessionInfo, setSessionInfo] = useState(null);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [creditsRemaining, setCreditsRemaining] = useState(null);
    const [latestTrace, setLatestTrace] = useState(null);
    const [currentPhase, setCurrentPhase] = useState('clarify');
    const [report, setReport] = useState(null);
    const [reportLoading, setReportLoading] = useState(false);
    const [showReport, setShowReport] = useState(false);

    const messagesEndRef = useRef(null);

    useEffect(() => {
        const stored = localStorage.getItem('casecoach_session');
        if (stored) {
            const info = JSON.parse(stored);
            if (info.session_id === sessionId) {
                setSessionInfo(info);
                setCreditsRemaining(info.credits);
            }
        }
        loadMessages();
    }, [sessionId]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    async function loadMessages() {
        try {
            const res = await fetch(`/api/messages?session_id=${sessionId}`);
            const data = await res.json();
            if (data.messages) {
                setMessages(data.messages);
                // Determine current phase from messages
                const systemMsgs = data.messages.filter(m => m.role === 'system');
                if (systemMsgs.length > 0) {
                    const lastPhase = [...systemMsgs].reverse().find(m => m.phase);
                    if (lastPhase?.phase) setCurrentPhase(lastPhase.phase);
                }
                // Find latest trace
                const lastSystem = [...data.messages].reverse().find(m => m.role === 'system' && m.agent_trace);
                if (lastSystem) setLatestTrace(lastSystem.agent_trace);
            }
        } catch (err) {
            console.error('Failed to load messages:', err);
        }
    }

    async function handleSend(e) {
        e.preventDefault();
        if (!input.trim() || loading) return;

        const userMessage = input.trim();
        setInput('');
        setLoading(true);

        setMessages(prev => [...prev, {
            id: 'temp-' + Date.now(),
            role: 'student',
            content: userMessage,
            created_at: new Date().toISOString()
        }]);

        try {
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ session_id: sessionId, message: userMessage })
            });

            const data = await res.json();

            if (!res.ok) {
                setMessages(prev => [...prev, {
                    id: 'error-' + Date.now(),
                    role: 'system',
                    content: data.error || 'Something went wrong.',
                    created_at: new Date().toISOString()
                }]);
                setLoading(false);
                return;
            }

            // Update phase
            if (data.phase) setCurrentPhase(data.phase);

            // Build system message
            const sysMsg = {
                id: 'sys-' + Date.now(),
                role: 'system',
                content: data.content || data.final_summary,
                phase: data.phase,
                rubric: data.rubric,
                questions: data.questions,
                coaching_hint: data.coaching_hint,
                agent_trace: data.agent_responses?.length > 0 ? {
                    intent: data.intent,
                    agents_activated: data.agents_activated,
                    agent_responses: data.agent_responses,
                    final_recommendation: data.final_recommendation,
                    escalation_path: data.escalation_path
                } : null,
                created_at: new Date().toISOString()
            };

            setMessages(prev => [...prev, sysMsg]);

            if (sysMsg.agent_trace) setLatestTrace(sysMsg.agent_trace);
            if (data.credits_remaining !== undefined) setCreditsRemaining(data.credits_remaining);
        } catch (err) {
            setMessages(prev => [...prev, {
                id: 'error-' + Date.now(),
                role: 'system',
                content: 'Connection error. Please try again.',
                created_at: new Date().toISOString()
            }]);
            toast?.error('Connection error. Please try again.');
        }
        setLoading(false);
    }

    function handleKeyDown(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend(e);
        }
    }

    const totalCredits = sessionInfo?.credits || 25;
    const usedPercent = creditsRemaining !== null ? ((totalCredits - creditsRemaining) / totalCredits) * 100 : 0;
    const isLowCredits = creditsRemaining !== null && creditsRemaining <= 5;

    return (
        <>
            <nav className="navbar">
                <div className="navbar-inner">
                    <a href="/" className="navbar-brand">
                        <div>
                            <h1>CaseCoach AI</h1>
                            <div className="subtitle">Executive Decision Coach</div>
                        </div>
                    </a>
                    <div className="navbar-actions">
                        {sessionInfo && <span style={{ fontSize: '0.8rem', opacity: 0.8 }}>{sessionInfo.student_name}</span>}
                        <button className="btn btn-outline" onClick={() => router.push('/')}>Exit</button>
                    </div>
                </div>
            </nav>

            <div className="page-shell">
                {sessionInfo && (
                    <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <h2 style={{ fontSize: '1.1rem' }}>{sessionInfo.assignment_title}</h2>
                        <div className={`credits-bar ${isLowCredits ? 'warning' : ''}`}>
                            <span className="count">{creditsRemaining ?? '—'}</span>
                            <span>turns left</span>
                            <div className="credits-track" style={{ width: '80px' }}>
                                <div className={`credits-fill ${isLowCredits ? 'warning' : ''}`} style={{ width: `${100 - usedPercent}%` }} />
                            </div>
                        </div>
                    </div>
                )}

                <div className="chat-layout">
                    <div className="card chat-main">
                        <div className="chat-messages">
                            {messages.length === 0 && (
                                <div style={{ textAlign: 'center', padding: '3rem 1.5rem', color: 'var(--text-muted)' }}>
                                    <svg width="56" height="56" viewBox="0 0 56 56" fill="none" style={{ margin: '0 auto 1rem' }}>
                                        <rect width="56" height="56" rx="14" fill="var(--bg)" />
                                        <path d="M16 18h24v2H16zM16 24h20v2H16zM16 30h24v2H16zM16 36h14v2H16z" fill="var(--border)" />
                                    </svg>
                                    <h3 style={{ fontFamily: 'var(--font-serif)', marginBottom: '0.5rem' }}>Start your analysis</h3>
                                    <p style={{ fontSize: '0.88rem', maxWidth: '400px', margin: '0 auto', lineHeight: 1.55 }}>
                                        Present your analysis of the case. Start with your recommendation and reasoning — the coaching system
                                        will guide you through a structured critique before you interact with the executive team.
                                    </p>
                                </div>
                            )}

                            {messages.map(msg => (
                                <div key={msg.id}>
                                    {msg.role === 'student' && (
                                        <div className="message-bubble student">{msg.content}</div>
                                    )}

                                    {msg.role === 'system' && (
                                        <div style={{ maxWidth: '85%' }}>
                                            {/* Phase-specific system message */}
                                            <div className={`message-bubble system`}>
                                                {msg.content}

                                                {/* Coaching hint */}
                                                {msg.coaching_hint && (
                                                    <div style={{
                                                        marginTop: '0.6rem',
                                                        padding: '0.5rem 0.7rem',
                                                        background: 'var(--sky-blue-light)',
                                                        borderRadius: 'var(--radius)',
                                                        fontSize: '0.8rem',
                                                        color: 'var(--brand-primary)'
                                                    }}>
                                                        💡 {msg.coaching_hint}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Rubric display */}
                                            {msg.rubric && (
                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.4rem', marginTop: '0.5rem' }}>
                                                    <RubricChip label="Problem Framing" score={msg.rubric.problem_framing} />
                                                    <RubricChip label="Evidence Use" score={msg.rubric.evidence_use} />
                                                    <RubricChip label="Tradeoff Quality" score={msg.rubric.tradeoff_quality} />
                                                    <RubricChip label="Risk/Compliance" score={msg.rubric.risk_compliance} />
                                                </div>
                                            )}

                                            {/* Agent responses (direction phase only) */}
                                            {msg.agent_trace?.agent_responses && (
                                                <div style={{ marginTop: '0.75rem' }}>
                                                    {msg.agent_trace.escalation_path?.length > 0 && (
                                                        <div className="escalation-path" style={{ marginBottom: '0.5rem' }}>
                                                            <span style={{ fontWeight: 600, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Escalation:</span>
                                                            {msg.agent_trace.escalation_path.map((step, i) => (
                                                                <span key={i}>{i > 0 && <span className="arrow">→</span>} {step}</span>
                                                            ))}
                                                        </div>
                                                    )}

                                                    {msg.agent_trace.agent_responses.map((agent, i) => (
                                                        <div key={i} className="agent-card" data-agent={agent.name}>
                                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                                <span className="agent-name">{agent.display_name}</span>
                                                                <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                                                                    <span className={`rec-badge ${agent.recommendation}`}>{formatRec(agent.recommendation)}</span>
                                                                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{agent.confidence}%</span>
                                                                </div>
                                                            </div>
                                                            <p className="agent-text">{agent.text}</p>
                                                        </div>
                                                    ))}

                                                    {msg.agent_trace.final_recommendation && (
                                                        <div style={{ marginTop: '0.5rem', padding: '0.6rem 0.9rem', background: 'var(--bg)', borderRadius: 'var(--radius)', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                            <strong>Final:</strong>
                                                            <span className={`rec-badge ${msg.agent_trace.final_recommendation}`}>{formatRec(msg.agent_trace.final_recommendation)}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}

                            {loading && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                    <span className="spinner" />
                                    {currentPhase === 'direction' ? 'Agents analyzing...' : 'Evaluating your reasoning...'}
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        <div className="chat-input-area">
                            <form onSubmit={handleSend} className="chat-input-row">
                                <textarea
                                    className="textarea"
                                    placeholder={currentPhase === 'clarify'
                                        ? "Present your recommendation and reasoning..."
                                        : currentPhase === 'critique'
                                            ? "Strengthen your argument based on the feedback..."
                                            : "Ask a question about the case..."}
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    disabled={loading || (creditsRemaining !== null && creditsRemaining <= 0)}
                                    rows={2}
                                />
                                <button className="btn btn-primary" type="submit" disabled={loading || !input.trim() || (creditsRemaining !== null && creditsRemaining <= 0)} style={{ whiteSpace: 'nowrap' }}>
                                    {loading ? <span className="spinner" /> : 'Send'}
                                </button>
                            </form>
                            {creditsRemaining !== null && creditsRemaining <= 0 && (
                                <p style={{ fontSize: '0.8rem', color: 'var(--accent-red)', marginTop: '0.5rem' }}>No turns remaining.</p>
                            )}
                        </div>
                    </div>

                    {/* Sidebar */}
                    <div className="chat-sidebar">
                        {/* Phase stepper */}
                        <div className="card sidebar-section">
                            <h3>Coaching Progress</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                <PhaseStep phase="clarify" label="1. Clarify" desc="Present your reasoning" current={currentPhase} />
                                <PhaseStep phase="critique" label="2. Critique" desc="Strengthen your argument" current={currentPhase} />
                                <PhaseStep phase="direction" label="3. Direction" desc="Executive team weighs in" current={currentPhase} />
                            </div>
                        </div>

                        {/* Agent hierarchy */}
                        <div className="card sidebar-section">
                            <h3>Agent Hierarchy</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                {renderHierarchyNode('CEO', latestTrace, currentPhase)}
                                <div style={{ display: 'flex', gap: '0.35rem', paddingLeft: '1.25rem' }}>
                                    {renderHierarchyNode('CFO', latestTrace, currentPhase)}
                                    {renderHierarchyNode('CMO', latestTrace, currentPhase)}
                                    {renderHierarchyNode('ChiefMedicalOfficer', latestTrace, currentPhase)}
                                </div>
                                <div style={{ paddingLeft: '2.5rem' }}>
                                    {renderHierarchyNode('Employee', latestTrace, currentPhase)}
                                </div>
                            </div>
                            {currentPhase !== 'direction' && (
                                <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.6rem', fontStyle: 'italic' }}>
                                    Complete the coaching phases to unlock the executive team.
                                </p>
                            )}
                        </div>

                        {/* Latest analysis (only in direction phase) */}
                        {latestTrace && currentPhase === 'direction' && (
                            <div className="card sidebar-section">
                                <h3>Latest Analysis</h3>
                                <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                                    <div style={{ marginBottom: '0.4rem' }}><strong>Intent:</strong> {formatIntent(latestTrace.intent)}</div>
                                    <div style={{ marginBottom: '0.4rem' }}><strong>Agents:</strong> {latestTrace.agents_activated?.length || 0} activated</div>
                                    <div><strong>Decision:</strong> <span className={`rec-badge ${latestTrace.final_recommendation}`}>{formatRec(latestTrace.final_recommendation)}</span></div>
                                </div>
                            </div>
                        )}

                        {/* Report button (direction phase only) */}
                        {currentPhase === 'direction' && (
                            <div className="card sidebar-section">
                                <h3>Executive Report</h3>
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.6rem' }}>
                                    Generate a structured report from your coaching session and executive analysis.
                                </p>
                                <button
                                    className="btn btn-primary"
                                    onClick={handleGenerateReport}
                                    disabled={reportLoading}
                                    style={{ width: '100%', fontSize: '0.82rem' }}
                                >
                                    {reportLoading ? <><span className="spinner" /> Generating...</> : '📄 Generate Report'}
                                </button>
                                {report && (
                                    <button
                                        className="btn btn-outline"
                                        onClick={() => setShowReport(true)}
                                        style={{ width: '100%', marginTop: '0.4rem', fontSize: '0.78rem' }}
                                    >
                                        View Report
                                    </button>
                                )}
                            </div>
                        )}

                        {/* Tips */}
                        <div className="card sidebar-section">
                            <h3>Tips</h3>
                            <ul style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', paddingLeft: '1rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                {currentPhase === 'clarify' && <>
                                    <li>Start with &ldquo;I recommend...&rdquo; or &ldquo;I think we should...&rdquo;</li>
                                    <li>Include at least one key risk or concern</li>
                                    <li>Reference specific numbers from the case</li>
                                </>}
                                {currentPhase === 'critique' && <>
                                    <li>Address the weak areas in the rubric</li>
                                    <li>Add tradeoffs and counterarguments</li>
                                    <li>Mention compliance or regulatory considerations</li>
                                </>}
                                {currentPhase === 'direction' && <>
                                    <li>Mention budget, ROI, or costs to activate the CFO</li>
                                    <li>Mention patients or clinical quality for medical agents</li>
                                    <li>Ask strategic questions for the full hierarchy</li>
                                </>}
                            </ul>
                        </div>

                        {/* Restart Session */}
                        <div style={{ marginTop: '0.25rem' }}>
                            <button
                                className="btn btn-ghost"
                                style={{ width: '100%', fontSize: '0.78rem', color: 'var(--text-muted)' }}
                                onClick={async () => {
                                    if (!confirm('Restart your session? All messages and progress will be cleared.')) return;
                                    try {
                                        const res = await fetch('/api/session-reset', {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ session_id: sessionId })
                                        });
                                        const data = await res.json();
                                        if (data.success) {
                                            setMessages([]);
                                            setCurrentPhase('clarify');
                                            setLatestTrace(null);
                                            setReport(null);
                                            setCreditsRemaining(sessionInfo?.credits || 25);
                                            toast?.success('Session restarted. Start fresh!');
                                        }
                                    } catch (err) {
                                        toast?.error('Failed to reset session');
                                    }
                                }}
                            >
                                ↺ Restart Session
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Report Modal */}
            {showReport && report && (
                <div style={{
                    position: 'fixed', inset: 0,
                    background: 'rgba(0,0,0,0.5)',
                    zIndex: 1000,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '2rem'
                }} onClick={() => setShowReport(false)}>
                    <div style={{
                        background: 'var(--bg-card)',
                        borderRadius: '12px',
                        maxWidth: '900px',
                        width: '100%',
                        maxHeight: '85vh',
                        overflow: 'auto',
                        padding: '2rem',
                        boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
                    }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                            <h2 style={{ fontSize: '1.15rem' }}>Executive Brief</h2>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button className="btn btn-outline" onClick={() => {
                                    navigator.clipboard.writeText(report);
                                }} style={{ fontSize: '0.78rem' }}>Copy</button>
                                <button className="btn btn-outline" onClick={() => {
                                    const blob = new Blob([report], { type: 'text/markdown;charset=utf-8' });
                                    const url = URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = 'executive_brief.md';
                                    a.click();
                                    URL.revokeObjectURL(url);
                                }} style={{ fontSize: '0.78rem' }}>Export .md</button>
                                <button className="btn btn-ghost" onClick={() => setShowReport(false)} style={{ fontSize: '0.78rem' }}>Close</button>
                            </div>
                        </div>
                        <div style={{
                            fontFamily: 'var(--font-sans)',
                            fontSize: '0.88rem',
                            lineHeight: 1.7,
                            whiteSpace: 'pre-wrap',
                            color: 'var(--text-primary)'
                        }}>
                            {report}
                        </div>
                    </div>
                </div>
            )}
        </>
    );

    async function handleGenerateReport() {
        setReportLoading(true);
        try {
            const res = await fetch('/api/report', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ session_id: sessionId })
            });
            const data = await res.json();
            if (res.ok && data.report) {
                setReport(data.report);
                setShowReport(true);
                toast?.success('Executive brief generated');
            } else {
                toast?.error('Could not generate report');
            }
        } catch (err) {
            console.error('Report generation failed:', err);
            toast?.error('Failed to generate report');
        }
        setReportLoading(false);
    }
}

function PhaseStep({ phase, label, desc, current }) {
    const phases = ['clarify', 'critique', 'direction'];
    const idx = phases.indexOf(phase);
    const currentIdx = phases.indexOf(current);
    const isComplete = idx < currentIdx;
    const isCurrent = phase === current;

    return (
        <div style={{
            display: 'flex', alignItems: 'center', gap: '0.6rem',
            padding: '0.5rem 0.65rem',
            borderRadius: 'var(--radius)',
            background: isCurrent ? 'var(--brand-primary)' : isComplete ? '#ECFDF5' : 'var(--bg)',
            transition: 'all 0.3s ease'
        }}>
            <div style={{
                width: '22px', height: '22px',
                borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.7rem', fontWeight: 700,
                background: isCurrent ? '#fff' : isComplete ? '#059669' : 'var(--border)',
                color: isCurrent ? 'var(--brand-primary)' : isComplete ? '#fff' : 'var(--text-muted)'
            }}>
                {isComplete ? '✓' : idx + 1}
            </div>
            <div>
                <div style={{ fontSize: '0.78rem', fontWeight: 600, color: isCurrent ? '#fff' : isComplete ? '#059669' : 'var(--text-primary)' }}>
                    {label}
                </div>
                <div style={{ fontSize: '0.68rem', color: isCurrent ? 'rgba(255,255,255,0.7)' : 'var(--text-muted)' }}>
                    {desc}
                </div>
            </div>
        </div>
    );
}

function RubricChip({ label, score }) {
    const colors = { weak: '#DC2626', developing: '#D97706', adequate: '#059669', strong: '#059669' };
    const bgs = { weak: '#FEF2F2', developing: '#FFFBEB', adequate: '#ECFDF5', strong: '#ECFDF5' };
    return (
        <div style={{
            padding: '0.4rem 0.5rem', borderRadius: 'var(--radius)',
            background: bgs[score] || '#F3F4F6', textAlign: 'center'
        }}>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: colors[score] || '#6B7280', textTransform: 'capitalize' }}>{score}</div>
        </div>
    );
}

function renderHierarchyNode(agentName, trace, phase) {
    const displayNames = { Employee: 'Employee', CFO: 'CFO', CMO: 'CMO', ChiefMedicalOfficer: 'CMedO', CEO: 'CEO' };
    const colors = { Employee: 'var(--agent-employee)', CFO: 'var(--agent-cfo)', CMO: 'var(--agent-cmo)', ChiefMedicalOfficer: 'var(--agent-cmedo)', CEO: 'var(--agent-ceo)' };
    const isActive = trace?.agents_activated?.includes(agentName);
    const isLocked = phase !== 'direction';
    const agentResponse = trace?.agent_responses?.find(r => r.name === agentName);

    return (
        <div style={{
            flex: 1, padding: '0.45rem 0.6rem', borderRadius: 'var(--radius)',
            border: `1.5px solid ${isActive ? colors[agentName] : 'var(--border-light)'}`,
            background: isActive ? `${colors[agentName]}10` : 'var(--bg-card)',
            fontSize: '0.72rem', textAlign: 'center',
            transition: 'all 0.3s ease',
            opacity: isLocked ? 0.35 : isActive ? 1 : 0.5
        }}>
            <div style={{ fontWeight: 700, color: isActive ? colors[agentName] : 'var(--text-muted)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {isLocked ? '🔒 ' : ''}{displayNames[agentName]}
            </div>
            {isActive && agentResponse && (
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>{agentResponse.confidence}%</div>
            )}
        </div>
    );
}

function formatRec(rec) {
    const map = { proceed: 'Proceed', hold: 'Hold', do_not_proceed: 'Block', need_more_data: 'Need Data', advisory: 'Advisory' };
    return map[rec] || rec || '—';
}

function formatIntent(intent) {
    const map = { exec_decision: 'Executive Decision', financial: 'Financial', clinical: 'Clinical', strategic: 'Strategic', operational: 'Operational', compliance: 'Compliance', escalation: 'Escalation', phi_sensitive: 'PHI Detected', general: 'General' };
    return map[intent] || intent || '—';
}

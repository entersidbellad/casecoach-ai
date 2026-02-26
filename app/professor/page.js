'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ProfessorDashboard() {
    const router = useRouter();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('assignments');
    const [selectedAssignment, setSelectedAssignment] = useState(null);

    // Directive state
    const [directiveText, setDirectiveText] = useState('');
    const [directives, setDirectives] = useState([]);
    const [directiveLoading, setDirectiveLoading] = useState(false);

    // Logs state
    const [logs, setLogs] = useState([]);
    const [logsLoading, setLogsLoading] = useState(false);
    const [expandedLog, setExpandedLog] = useState(null);

    // Assignment creation state
    const [showCreateAssignment, setShowCreateAssignment] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [newCaseId, setNewCaseId] = useState('');
    const [newCredits, setNewCredits] = useState(25);
    const [creating, setCreating] = useState(false);
    const [createMsg, setCreateMsg] = useState('');
    const [cases, setCases] = useState([]);

    // Analytics state
    const [analytics, setAnalytics] = useState(null);
    const [analyticsLoading, setAnalyticsLoading] = useState(false);

    useEffect(() => {
        loadDashboard();
        loadCases();
    }, []);

    async function loadDashboard() {
        try {
            const res = await fetch('/api/dashboard');
            const json = await res.json();
            if (res.ok) {
                setData(json);
                if (json.assignments?.length > 0) {
                    setSelectedAssignment(json.assignments[0]);
                }
            }
        } catch (err) {
            console.error('Dashboard load error:', err);
        }
        setLoading(false);
    }

    async function loadCases() {
        try {
            const res = await fetch('/api/cases');
            const json = await res.json();
            if (res.ok) setCases(json.cases || []);
        } catch (err) { console.error(err); }
    }

    async function handleCreateAssignment(e) {
        e.preventDefault();
        if (!newTitle.trim() || !newCaseId) return;
        setCreating(true);
        setCreateMsg('');
        try {
            const res = await fetch('/api/assignments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ case_id: newCaseId, title: newTitle.trim(), credits: newCredits })
            });
            const json = await res.json();
            if (res.ok) {
                setCreateMsg(`Created! Join code: ${json.assignment.join_code}`);
                setNewTitle('');
                setNewCaseId('');
                setNewCredits(25);
                setShowCreateAssignment(false);
                await loadDashboard();
            } else {
                setCreateMsg(json.error || 'Failed');
            }
        } catch (err) {
            setCreateMsg('Error creating assignment');
        }
        setCreating(false);
        setTimeout(() => setCreateMsg(''), 5000);
    }

    async function loadDirectives(assignmentId) {
        const res = await fetch(`/api/directives?assignment_id=${assignmentId}`);
        const json = await res.json();
        if (res.ok) setDirectives(json.directives || []);
    }

    async function loadLogs(assignmentId) {
        setLogsLoading(true);
        const res = await fetch(`/api/logs?assignment_id=${assignmentId}`);
        const json = await res.json();
        if (res.ok) setLogs(json.messages || []);
        setLogsLoading(false);
    }

    async function handleAddDirective(e) {
        e.preventDefault();
        if (!directiveText.trim() || !selectedAssignment) return;
        setDirectiveLoading(true);

        const res = await fetch('/api/directives', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                assignment_id: selectedAssignment.id,
                content: directiveText.trim()
            })
        });

        if (res.ok) {
            setDirectiveText('');
            await loadDirectives(selectedAssignment.id);
        }
        setDirectiveLoading(false);
    }

    async function handleRemoveDirective(id) {
        await fetch(`/api/directives?id=${id}`, { method: 'DELETE' });
        await loadDirectives(selectedAssignment.id);
    }

    function handleTabChange(tab) {
        setActiveTab(tab);
        if (selectedAssignment) {
            if (tab === 'directives') loadDirectives(selectedAssignment.id);
            if (tab === 'logs') loadLogs(selectedAssignment.id);
        }
        if (tab === 'analytics') loadAnalytics();
    }

    async function loadAnalytics() {
        setAnalyticsLoading(true);
        try {
            const res = await fetch('/api/analytics');
            const json = await res.json();
            if (res.ok) setAnalytics(json);
        } catch (err) { console.error(err); }
        setAnalyticsLoading(false);
    }

    if (loading) {
        return (
            <>
                <NavBar />
                <div className="page-shell" style={{ textAlign: 'center', padding: '4rem' }}>
                    <span className="spinner" />
                </div>
            </>
        );
    }

    return (
        <>
            <NavBar />
            <div className="page-shell">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                    <div>
                        <h1>Professor Dashboard</h1>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginTop: '0.25rem' }}>
                            {data?.professor?.name} — Manage cases, assignments, and student interactions
                        </p>
                    </div>
                    <button className="btn btn-primary" onClick={() => router.push('/professor/cases')}>
                        Manage Cases
                    </button>
                </div>

                {/* Tab navigation */}
                <div style={{
                    display: 'flex',
                    gap: '0.25rem',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)',
                    padding: '3px',
                    marginBottom: '1.25rem',
                    maxWidth: '600px'
                }}>
                    {['assignments', 'directives', 'logs', 'analytics'].map(tab => (
                        <button
                            key={tab}
                            className="btn"
                            onClick={() => handleTabChange(tab)}
                            style={{
                                flex: 1,
                                background: activeTab === tab ? 'var(--brand-primary)' : 'transparent',
                                color: activeTab === tab ? '#fff' : 'var(--text-secondary)',
                                fontSize: '0.82rem',
                                padding: '0.5rem 0.75rem',
                                borderRadius: '6px',
                                textTransform: 'capitalize'
                            }}
                        >
                            {tab}
                        </button>
                    ))}
                </div>

                {/* === ASSIGNMENTS TAB === */}
                {activeTab === 'assignments' && (
                    <div style={{ display: 'grid', gap: '1rem' }}>
                        {/* Create Assignment button */}
                        {!showCreateAssignment ? (
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                <button className="btn btn-primary" onClick={() => setShowCreateAssignment(true)} style={{ fontSize: '0.85rem' }}>
                                    + Create Assignment
                                </button>
                                {createMsg && <span style={{ fontSize: '0.82rem', color: '#059669' }}>{createMsg}</span>}
                            </div>
                        ) : (
                            <div className="card" style={{ padding: '1.25rem' }}>
                                <h2 style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>Create New Assignment</h2>
                                <form onSubmit={handleCreateAssignment}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '0.75rem', alignItems: 'end' }}>
                                        <div>
                                            <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Assignment Title</label>
                                            <input className="input" type="text" placeholder="e.g. Spring 2026 — Apex Analysis" value={newTitle} onChange={e => setNewTitle(e.target.value)} />
                                        </div>
                                        <div>
                                            <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Case</label>
                                            <select className="input" value={newCaseId} onChange={e => setNewCaseId(e.target.value)} style={{ height: '38px' }}>
                                                <option value="">Select a case...</option>
                                                {cases.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Credits</label>
                                            <input className="input" type="number" min="1" max="100" value={newCredits} onChange={e => setNewCredits(Number(e.target.value))} style={{ width: '70px' }} />
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                                        <button className="btn btn-primary" type="submit" disabled={creating || !newTitle.trim() || !newCaseId}>
                                            {creating ? <span className="spinner" /> : 'Create'}
                                        </button>
                                        <button className="btn btn-ghost" type="button" onClick={() => setShowCreateAssignment(false)}>Cancel</button>
                                    </div>
                                </form>
                            </div>
                        )}
                        {data?.assignments?.map(a => (
                            <div key={a.id} className="card" style={{ padding: '1.25rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div>
                                        <h2 style={{ fontSize: '1.05rem', marginBottom: '0.25rem' }}>{a.title}</h2>
                                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                            Case: {a.case_title || 'No case assigned'}
                                        </p>
                                    </div>
                                    <div style={{
                                        background: 'var(--brand-primary)',
                                        color: '#fff',
                                        padding: '0.5rem 0.9rem',
                                        borderRadius: 'var(--radius)',
                                        fontWeight: 700,
                                        fontSize: '1rem',
                                        fontFamily: 'var(--font-sans)',
                                        letterSpacing: '0.12em',
                                        textAlign: 'center'
                                    }}>
                                        {a.join_code}
                                        <div style={{ fontSize: '0.6rem', fontWeight: 500, opacity: 0.7, letterSpacing: '0.08em' }}>JOIN CODE</div>
                                    </div>
                                </div>

                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(4, 1fr)',
                                    gap: '0.75rem',
                                    marginTop: '1rem'
                                }}>
                                    <StatBox label="Students" value={a.student_count} />
                                    <StatBox label="Total Turns" value={a.total_turns} />
                                    <StatBox label="Credits/Student" value={a.credits} />
                                    <StatBox label="Active Directives" value={a.active_directives} />
                                </div>

                                {a.sessions?.length > 0 && (
                                    <div style={{ marginTop: '1rem' }}>
                                        <h3 style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', fontFamily: 'var(--font-sans)', marginBottom: '0.5rem' }}>
                                            Students
                                        </h3>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                                            {a.sessions.map(s => (
                                                <div key={s.id} style={{
                                                    padding: '0.35rem 0.7rem',
                                                    background: 'var(--bg)',
                                                    borderRadius: '100px',
                                                    fontSize: '0.78rem',
                                                    color: 'var(--text-secondary)'
                                                }}>
                                                    {s.student_name} · {s.credits_used} turns
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}

                        {(!data?.assignments || data.assignments.length === 0) && (
                            <div className="card" style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                No assignments yet. Create one above or seed demo data to get started.
                            </div>
                        )}
                    </div>
                )}

                {/* === DIRECTIVES TAB === */}
                {activeTab === 'directives' && selectedAssignment && (
                    <div>
                        <div className="card" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
                            <h2 style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>
                                Inject Directive — {selectedAssignment.title}
                            </h2>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem', lineHeight: 1.5 }}>
                                Directives modify how all agents respond. Active directives are appended to every agent&apos;s prompt.
                            </p>
                            <form onSubmit={handleAddDirective}>
                                <textarea
                                    className="textarea"
                                    placeholder='e.g. "Push back harder on proposals without a 90-day pilot plan" or "Emphasize compliance risk this week"'
                                    value={directiveText}
                                    onChange={(e) => setDirectiveText(e.target.value)}
                                    rows={3}
                                />
                                <button
                                    className="btn btn-primary"
                                    type="submit"
                                    disabled={!directiveText.trim() || directiveLoading}
                                    style={{ marginTop: '0.75rem' }}
                                >
                                    {directiveLoading ? <span className="spinner" /> : 'Add Directive'}
                                </button>
                            </form>
                        </div>

                        <h3 style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', fontFamily: 'var(--font-sans)', marginBottom: '0.5rem' }}>
                            Active Directives
                        </h3>
                        {directives.length === 0 ? (
                            <div className="card" style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                                No active directives. Add one above to influence agent behavior.
                            </div>
                        ) : (
                            <div style={{ display: 'grid', gap: '0.5rem' }}>
                                {directives.map(d => (
                                    <div key={d.id} className="card" style={{
                                        padding: '0.8rem 1rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        gap: '1rem'
                                    }}>
                                        <div>
                                            <p style={{ fontSize: '0.9rem' }}>&ldquo;{d.content}&rdquo;</p>
                                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                                Added {new Date(d.created_at).toLocaleDateString()}
                                            </span>
                                        </div>
                                        <button
                                            className="btn btn-ghost"
                                            onClick={() => handleRemoveDirective(d.id)}
                                            style={{ color: 'var(--accent-red)', fontSize: '0.78rem', whiteSpace: 'nowrap' }}
                                        >
                                            Remove
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* === LOGS TAB === */}
                {activeTab === 'logs' && selectedAssignment && (
                    <div>
                        <h2 style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>
                            Conversation Logs — {selectedAssignment.title}
                        </h2>

                        {logsLoading ? (
                            <div style={{ textAlign: 'center', padding: '2rem' }}><span className="spinner" /></div>
                        ) : logs.length === 0 ? (
                            <div className="card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                No conversations yet. Students will appear here once they start chatting.
                            </div>
                        ) : (
                            <div style={{ display: 'grid', gap: '0.5rem' }}>
                                {logs.map(msg => (
                                    <div
                                        key={msg.id}
                                        className="card"
                                        style={{ padding: '0.8rem 1rem', cursor: msg.agent_trace ? 'pointer' : 'default' }}
                                        onClick={() => msg.agent_trace && setExpandedLog(expandedLog === msg.id ? null : msg.id)}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                            <span style={{
                                                padding: '0.2rem 0.5rem',
                                                borderRadius: '100px',
                                                fontSize: '0.7rem',
                                                fontWeight: 600,
                                                textTransform: 'uppercase',
                                                background: msg.role === 'student' ? 'var(--brand-primary)' : 'var(--bg)',
                                                color: msg.role === 'student' ? '#fff' : 'var(--text-secondary)'
                                            }}>
                                                {msg.role === 'student' ? msg.student_name || 'Student' : 'System'}
                                            </span>
                                            <p style={{ fontSize: '0.88rem', flex: 1 }}>
                                                {msg.content?.length > 150 ? msg.content.substring(0, 150) + '...' : msg.content}
                                            </p>
                                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                                                {new Date(msg.created_at).toLocaleTimeString()}
                                            </span>
                                        </div>

                                        {/* Expanded trace */}
                                        {expandedLog === msg.id && msg.agent_trace && (
                                            <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-light)' }}>
                                                {msg.agent_trace.agent_responses?.map((agent, i) => (
                                                    <div key={i} className="agent-card" data-agent={agent.name} style={{ marginBottom: '0.4rem' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                            <span className="agent-name">{agent.display_name || agent.name}</span>
                                                            <span className={`rec-badge ${agent.recommendation}`}>
                                                                {agent.recommendation}
                                                            </span>
                                                        </div>
                                                        <p className="agent-text">{agent.text}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* === ANALYTICS TAB === */}
                {activeTab === 'analytics' && (
                    <div style={{ display: 'grid', gap: '1rem' }}>
                        {analyticsLoading ? (
                            <div className="card" style={{ padding: '2rem', textAlign: 'center' }}><span className="spinner" /></div>
                        ) : !analytics ? (
                            <div className="card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                Loading analytics...
                            </div>
                        ) : (
                            <>
                                {/* Overview Stats */}
                                <div className="card" style={{ padding: '1.25rem' }}>
                                    <h2 style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>Overview</h2>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
                                        <StatBox label="Sessions" value={analytics.overview.total_sessions} />
                                        <StatBox label="Messages" value={analytics.overview.total_messages} />
                                        <StatBox label="Student Turns" value={analytics.overview.total_student_messages} />
                                        <StatBox label="Reached Direction" value={analytics.overview.sessions_reaching_direction} />
                                    </div>
                                </div>

                                {/* Rubric Averages */}
                                {Object.keys(analytics.rubric_averages).length > 0 && (
                                    <div className="card" style={{ padding: '1.25rem' }}>
                                        <h2 style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>Average Rubric Scores</h2>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
                                            {Object.entries(analytics.rubric_averages).map(([dim, data]) => (
                                                <div key={dim} style={{
                                                    background: 'var(--bg)',
                                                    borderRadius: 'var(--radius)',
                                                    padding: '0.75rem',
                                                    textAlign: 'center'
                                                }}>
                                                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>
                                                        {dim.replace(/_/g, ' ')}
                                                    </div>
                                                    <div style={{
                                                        fontSize: '1.1rem', fontWeight: 700,
                                                        color: data.label === 'Weak' ? '#DC2626' : data.label === 'Developing' ? '#D97706' : '#059669'
                                                    }}>
                                                        {data.label}
                                                    </div>
                                                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                                                        {data.average}/4 ({data.count} evals)
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Weak Areas */}
                                {analytics.weak_areas?.length > 0 && (
                                    <div className="card" style={{ padding: '1.25rem' }}>
                                        <h2 style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>Most Common Weak Areas</h2>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                            {analytics.weak_areas.filter(a => a.totalEvals > 0).map(area => (
                                                <div key={area.dimension} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                    <span style={{ fontSize: '0.82rem', fontWeight: 600, width: '140px' }}>{area.dimension}</span>
                                                    <div style={{ flex: 1, height: '20px', background: 'var(--bg)', borderRadius: '100px', overflow: 'hidden' }}>
                                                        <div style={{
                                                            height: '100%',
                                                            width: `${area.weakPercent}%`,
                                                            background: area.weakPercent > 50 ? '#DC2626' : area.weakPercent > 25 ? '#D97706' : '#059669',
                                                            borderRadius: '100px',
                                                            transition: 'width 0.5s ease'
                                                        }} />
                                                    </div>
                                                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', width: '60px', textAlign: 'right' }}>
                                                        {area.weakPercent}% weak
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Phase Distribution */}
                                {analytics.phase_distribution?.length > 0 && (
                                    <div className="card" style={{ padding: '1.25rem' }}>
                                        <h2 style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>Phase Distribution</h2>
                                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                                            {analytics.phase_distribution.map(p => (
                                                <div key={p.phase} style={{
                                                    flex: 1,
                                                    background: 'var(--bg)',
                                                    borderRadius: 'var(--radius)',
                                                    padding: '0.75rem',
                                                    textAlign: 'center'
                                                }}>
                                                    <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--brand-primary)' }}>{p.count}</div>
                                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>{p.phase}</div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Per-Session Stats */}
                                {analytics.session_stats?.length > 0 && (
                                    <div className="card" style={{ padding: '1.25rem' }}>
                                        <h2 style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>Student Sessions</h2>
                                        <table style={{ width: '100%', fontSize: '0.82rem', borderCollapse: 'collapse' }}>
                                            <thead>
                                                <tr style={{ borderBottom: '2px solid var(--border)' }}>
                                                    <th style={{ textAlign: 'left', padding: '0.5rem', fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Student</th>
                                                    <th style={{ textAlign: 'center', padding: '0.5rem', fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Turns Used</th>
                                                    <th style={{ textAlign: 'center', padding: '0.5rem', fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Messages</th>
                                                    <th style={{ textAlign: 'right', padding: '0.5rem', fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Started</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {analytics.session_stats.map(s => (
                                                    <tr key={s.session_id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                                                        <td style={{ padding: '0.5rem', fontWeight: 500 }}>{s.student_name || 'Unknown'}</td>
                                                        <td style={{ padding: '0.5rem', textAlign: 'center' }}>{s.credits_used}</td>
                                                        <td style={{ padding: '0.5rem', textAlign: 'center' }}>{s.message_count}</td>
                                                        <td style={{ padding: '0.5rem', textAlign: 'right', color: 'var(--text-muted)' }}>
                                                            {new Date(s.created_at).toLocaleDateString()}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}
            </div>
        </>
    );
}

function NavBar() {
    const router = useRouter();
    return (
        <nav className="navbar">
            <div className="navbar-inner">
                <a href="/" className="navbar-brand">
                    <div>
                        <h1>CaseCoach AI</h1>
                        <div className="subtitle">Professor Dashboard</div>
                    </div>
                </a>
                <button className="btn btn-outline" onClick={() => router.push('/')}>Exit</button>
            </div>
        </nav>
    );
}

function StatBox({ label, value }) {
    return (
        <div style={{
            background: 'var(--bg)',
            borderRadius: 'var(--radius)',
            padding: '0.65rem 0.75rem',
            textAlign: 'center'
        }}>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--brand-primary)', fontFamily: 'var(--font-serif)' }}>
                {value}
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: '0.15rem' }}>
                {label}
            </div>
        </div>
    );
}

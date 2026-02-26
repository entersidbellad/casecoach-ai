'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

const AGENT_NAMES = ['Employee', 'CFO', 'CMO', 'ChiefMedicalOfficer', 'CEO'];

export default function CaseManagement() {
    const router = useRouter();
    const [cases, setCases] = useState([]);
    const [selectedCase, setSelectedCase] = useState(null);
    const [overrides, setOverrides] = useState([]);
    const [loading, setLoading] = useState(true);

    // Upload state
    const [uploadFile, setUploadFile] = useState(null);
    const [uploadTitle, setUploadTitle] = useState('');
    const [uploading, setUploading] = useState(false);
    const [uploadResult, setUploadResult] = useState(null);

    // Edit state
    const [editKpis, setEditKpis] = useState('');
    const [editRedLines, setEditRedLines] = useState('');
    const [editGoals, setEditGoals] = useState('');
    const [saving, setSaving] = useState(false);
    const [saveMsg, setSaveMsg] = useState('');

    useEffect(() => { loadCases(); }, []);

    async function loadCases() {
        try {
            const res = await fetch('/api/cases');
            const data = await res.json();
            if (res.ok) setCases(data.cases || []);
        } catch (err) { console.error(err); }
        setLoading(false);
    }

    async function loadCase(id) {
        const res = await fetch(`/api/cases?id=${id}`);
        const data = await res.json();
        if (res.ok && data.case) {
            setSelectedCase(data.case);
            setOverrides(data.overrides || []);
            setEditKpis(JSON.stringify(data.case.kpis || {}, null, 2));
            setEditRedLines((data.case.red_lines || []).join('\n'));
            setEditGoals(JSON.stringify(data.case.goals || {}, null, 2));
        }
    }

    async function handleUpload(e) {
        e.preventDefault();
        if (!uploadFile || !uploadTitle.trim()) return;
        setUploading(true);
        setUploadResult(null);

        const formData = new FormData();
        formData.append('pdf', uploadFile);
        formData.append('title', uploadTitle.trim());

        try {
            const res = await fetch('/api/upload-pdf', { method: 'POST', body: formData });
            const data = await res.json();
            if (res.ok) {
                setUploadResult({ success: true, ...data });
                setUploadFile(null);
                setUploadTitle('');
                await loadCases();
            } else {
                setUploadResult({ success: false, error: data.error });
            }
        } catch (err) {
            setUploadResult({ success: false, error: 'Upload failed' });
        }
        setUploading(false);
    }

    async function handleSave(e) {
        e.preventDefault();
        if (!selectedCase) return;
        setSaving(true);
        setSaveMsg('');

        let kpis, goals;
        try { kpis = JSON.parse(editKpis); } catch { setSaveMsg('Invalid KPIs JSON'); setSaving(false); return; }
        try { goals = JSON.parse(editGoals); } catch { setSaveMsg('Invalid Goals JSON'); setSaving(false); return; }

        const red_lines = editRedLines.split('\n').map(l => l.trim()).filter(Boolean);

        try {
            const res = await fetch('/api/cases', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: selectedCase.id,
                    title: selectedCase.title,
                    kpis,
                    red_lines,
                    goals
                })
            });
            if (res.ok) {
                setSaveMsg('Saved!');
                await loadCase(selectedCase.id);
            } else {
                setSaveMsg('Save failed');
            }
        } catch (err) {
            setSaveMsg('Save failed');
        }
        setSaving(false);
        setTimeout(() => setSaveMsg(''), 3000);
    }

    async function handleOverrideSave(agentName, text) {
        if (!selectedCase) return;
        await fetch('/api/cases', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: selectedCase.id,
                title: selectedCase.title,
                kpis: selectedCase.kpis,
                red_lines: selectedCase.red_lines,
                goals: selectedCase.goals,
                agent_overrides: [{ agent_name: agentName, prompt_addition: text }]
            })
        });
        await loadCase(selectedCase.id);
    }

    return (
        <>
            <NavBar />
            <div className="page-shell">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                    <div>
                        <h1>Case Management</h1>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginTop: '0.25rem' }}>
                            Upload PDFs, configure KPIs, and set per-agent instructions
                        </p>
                    </div>
                    <button className="btn btn-outline" onClick={() => router.push('/professor')}>
                        ← Dashboard
                    </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '1.25rem' }}>
                    {/* Left: Upload + case list */}
                    <div>
                        {/* Upload section */}
                        <div className="card" style={{ padding: '1rem', marginBottom: '1rem' }}>
                            <h3 style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', fontFamily: 'var(--font-sans)', marginBottom: '0.75rem' }}>
                                Upload New Case
                            </h3>
                            <form onSubmit={handleUpload}>
                                <div style={{ marginBottom: '0.75rem' }}>
                                    <label htmlFor="caseTitle">Case Title</label>
                                    <input
                                        id="caseTitle"
                                        className="input"
                                        type="text"
                                        placeholder="e.g. Apex Health Plan"
                                        value={uploadTitle}
                                        onChange={(e) => setUploadTitle(e.target.value)}
                                    />
                                </div>
                                <div style={{ marginBottom: '0.75rem' }}>
                                    <label htmlFor="pdfFile">PDF File</label>
                                    <input
                                        id="pdfFile"
                                        type="file"
                                        accept=".pdf"
                                        onChange={(e) => setUploadFile(e.target.files[0])}
                                        style={{ fontSize: '0.85rem', width: '100%' }}
                                    />
                                </div>
                                <button className="btn btn-primary" type="submit" disabled={uploading || !uploadFile || !uploadTitle.trim()} style={{ width: '100%' }}>
                                    {uploading ? <span className="spinner" /> : 'Upload & Extract'}
                                </button>
                            </form>

                            {uploadResult && (
                                <div style={{
                                    marginTop: '0.75rem',
                                    padding: '0.6rem',
                                    borderRadius: 'var(--radius)',
                                    fontSize: '0.82rem',
                                    background: uploadResult.success ? '#ECFDF5' : '#FEF2F2',
                                    color: uploadResult.success ? '#059669' : 'var(--accent-red)'
                                }}>
                                    {uploadResult.success
                                        ? `✓ Extracted ${uploadResult.text_length.toLocaleString()} characters from ${uploadResult.pages} pages`
                                        : `✗ ${uploadResult.error}`
                                    }
                                </div>
                            )}
                        </div>

                        {/* Case list */}
                        <div className="card" style={{ padding: '1rem' }}>
                            <h3 style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', fontFamily: 'var(--font-sans)', marginBottom: '0.75rem' }}>
                                All Cases
                            </h3>
                            {loading ? (
                                <div style={{ textAlign: 'center', padding: '1rem' }}><span className="spinner" /></div>
                            ) : cases.length === 0 ? (
                                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No cases yet.</p>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                    {cases.map(c => (
                                        <button
                                            key={c.id}
                                            className="btn btn-ghost"
                                            onClick={() => loadCase(c.id)}
                                            style={{
                                                textAlign: 'left',
                                                padding: '0.6rem 0.75rem',
                                                background: selectedCase?.id === c.id ? 'var(--brand-primary)' : 'transparent',
                                                color: selectedCase?.id === c.id ? '#fff' : 'var(--text-primary)',
                                                borderRadius: 'var(--radius)',
                                                fontSize: '0.85rem'
                                            }}
                                        >
                                            {c.title}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right: Case editor */}
                    <div>
                        {!selectedCase ? (
                            <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                Select a case from the left to edit its configuration, or upload a new case PDF.
                            </div>
                        ) : (
                            <div style={{ display: 'grid', gap: '1rem' }}>
                                {/* Case info */}
                                <div className="card" style={{ padding: '1rem' }}>
                                    <h2 style={{ fontSize: '1.1rem', marginBottom: '0.25rem' }}>{selectedCase.title}</h2>
                                    <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                                        {selectedCase.pdf_text
                                            ? `${selectedCase.pdf_text.length.toLocaleString()} characters of case text loaded`
                                            : 'No case text loaded — upload a PDF above'
                                        }
                                    </p>
                                </div>

                                {/* KPIs + Red Lines + Goals */}
                                <form onSubmit={handleSave}>
                                    <div className="card" style={{ padding: '1rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                                            <h3 style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', fontFamily: 'var(--font-sans)' }}>
                                                Case Configuration
                                            </h3>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                {saveMsg && <span style={{ fontSize: '0.78rem', color: '#059669' }}>{saveMsg}</span>}
                                                <button className="btn btn-primary" type="submit" disabled={saving} style={{ fontSize: '0.8rem', padding: '0.4rem 0.9rem' }}>
                                                    {saving ? <span className="spinner" /> : 'Save'}
                                                </button>
                                            </div>
                                        </div>

                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                            <div>
                                                <label>KPIs (JSON)</label>
                                                <textarea
                                                    className="textarea"
                                                    value={editKpis}
                                                    onChange={(e) => setEditKpis(e.target.value)}
                                                    rows={8}
                                                    style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}
                                                />
                                            </div>
                                            <div>
                                                <label>Goals (JSON)</label>
                                                <textarea
                                                    className="textarea"
                                                    value={editGoals}
                                                    onChange={(e) => setEditGoals(e.target.value)}
                                                    rows={8}
                                                    style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}
                                                />
                                            </div>
                                        </div>

                                        <div style={{ marginTop: '1rem' }}>
                                            <label>Red Lines (one per line)</label>
                                            <textarea
                                                className="textarea"
                                                value={editRedLines}
                                                onChange={(e) => setEditRedLines(e.target.value)}
                                                rows={4}
                                                placeholder="No aggressive coding tactics&#10;No provider revolt&#10;No heavy member abrasion"
                                            />
                                        </div>
                                    </div>
                                </form>

                                {/* Agent overrides */}
                                <div className="card" style={{ padding: '1rem' }}>
                                    <h3 style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', fontFamily: 'var(--font-sans)', marginBottom: '0.75rem' }}>
                                        Per-Agent Prompt Overrides
                                    </h3>
                                    <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                                        Add extra instructions for each agent specific to this case. These are appended to the agent&apos;s base prompt.
                                    </p>
                                    <div style={{ display: 'grid', gap: '0.75rem' }}>
                                        {AGENT_NAMES.map(name => {
                                            const existing = overrides.find(o => o.agent_name === name);
                                            return (
                                                <AgentOverrideRow
                                                    key={name}
                                                    agentName={name}
                                                    currentOverride={existing?.prompt_addition || ''}
                                                    onSave={(text) => handleOverrideSave(name, text)}
                                                />
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}

function AgentOverrideRow({ agentName, currentOverride, onSave }) {
    const [text, setText] = useState(currentOverride);
    const [dirty, setDirty] = useState(false);

    const displayNames = {
        Employee: 'Employee',
        CFO: 'CFO',
        CMO: 'CMO',
        ChiefMedicalOfficer: 'Chief Medical Officer',
        CEO: 'CEO'
    };

    const colors = {
        Employee: 'var(--agent-employee)',
        CFO: 'var(--agent-cfo)',
        CMO: 'var(--agent-cmo)',
        ChiefMedicalOfficer: 'var(--agent-cmedo)',
        CEO: 'var(--agent-ceo)'
    };

    return (
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
            <div style={{
                minWidth: '90px',
                padding: '0.35rem 0.5rem',
                borderRadius: 'var(--radius)',
                border: `1.5px solid ${colors[agentName]}`,
                fontSize: '0.72rem',
                fontWeight: 700,
                color: colors[agentName],
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                textAlign: 'center',
                marginTop: '0.25rem'
            }}>
                {displayNames[agentName]}
            </div>
            <textarea
                className="textarea"
                value={text}
                onChange={(e) => { setText(e.target.value); setDirty(true); }}
                rows={2}
                placeholder={`Extra instructions for ${displayNames[agentName]}...`}
                style={{ fontSize: '0.82rem', flex: 1 }}
            />
            {dirty && (
                <button
                    className="btn btn-primary"
                    onClick={() => { onSave(text); setDirty(false); }}
                    style={{ fontSize: '0.75rem', padding: '0.35rem 0.6rem', whiteSpace: 'nowrap', marginTop: '0.25rem' }}
                >
                    Save
                </button>
            )}
        </div>
    );
}

function NavBar() {
    return (
        <nav className="navbar">
            <div className="navbar-inner">
                <a href="/professor" className="navbar-brand">
                    <div>
                        <h1>CaseCoach AI</h1>
                        <div className="subtitle">Case Management</div>
                    </div>
                </a>
                <a href="/" className="btn btn-outline">Exit</a>
            </div>
        </nav>
    );
}

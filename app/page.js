'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LandingPage() {
  const router = useRouter();
  const [mode, setMode] = useState('student'); // 'student' or 'professor'
  const [joinCode, setJoinCode] = useState('');
  const [studentName, setStudentName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleStudentJoin(e) {
    e.preventDefault();
    if (!joinCode.trim() || !studentName.trim()) {
      setError('Please enter both your name and join code.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          join_code: joinCode.trim(),
          student_name: studentName.trim()
        })
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to join. Check your code.');
        setLoading(false);
        return;
      }

      // Store session in localStorage and navigate
      localStorage.setItem('casecoach_session', JSON.stringify(data));
      router.push(`/student/${data.session_id}`);
    } catch (err) {
      setError('Connection error. Please try again.');
      setLoading(false);
    }
  }

  async function handleProfessorLogin(e) {
    e.preventDefault();
    setLoading(true);

    // Seed demo data and go to professor dashboard
    try {
      await fetch('/api/seed', { method: 'POST' });
      router.push('/professor');
    } catch (err) {
      setError('Failed to initialize. Please try again.');
      setLoading(false);
    }
  }

  return (
    <div className="landing">
      <div className="landing-card">
        <div style={{ marginBottom: '0.5rem' }}>
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none" style={{ margin: '0 auto' }}>
            <rect width="48" height="48" rx="10" fill="#001A57" />
            <path d="M14 16h20v2H14zM14 22h16v2H14zM14 28h20v2H14zM14 34h12v2H14z" fill="#fff" />
            <circle cx="36" cy="14" r="4" fill="#CD273C" />
          </svg>
        </div>
        <h1>CaseCoach AI</h1>
        <p className="subtitle">Executive Decision Coaching Platform</p>

        {/* Toggle */}
        <div style={{
          display: 'flex',
          background: 'var(--bg)',
          borderRadius: 'var(--radius)',
          padding: '3px',
          marginBottom: '1.5rem'
        }}>
          <button
            onClick={() => { setMode('student'); setError(''); }}
            className="btn"
            style={{
              flex: 1,
              background: mode === 'student' ? 'var(--brand-primary)' : 'transparent',
              color: mode === 'student' ? '#fff' : 'var(--text-secondary)',
              fontSize: '0.82rem',
              padding: '0.5rem',
              borderRadius: '6px'
            }}
          >
            Student
          </button>
          <button
            onClick={() => { setMode('professor'); setError(''); }}
            className="btn"
            style={{
              flex: 1,
              background: mode === 'professor' ? 'var(--brand-primary)' : 'transparent',
              color: mode === 'professor' ? '#fff' : 'var(--text-secondary)',
              fontSize: '0.82rem',
              padding: '0.5rem',
              borderRadius: '6px'
            }}
          >
            Professor
          </button>
        </div>

        {error && (
          <div style={{
            background: '#FEF2F2',
            color: 'var(--accent-red)',
            padding: '0.6rem 0.9rem',
            borderRadius: 'var(--radius)',
            fontSize: '0.85rem',
            marginBottom: '1rem',
            textAlign: 'left'
          }}>
            {error}
          </div>
        )}

        {mode === 'student' ? (
          <form onSubmit={handleStudentJoin}>
            <div className="form-group">
              <label htmlFor="studentName">Your Name</label>
              <input
                id="studentName"
                className="input"
                type="text"
                placeholder="e.g. Jane Smith"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                autoComplete="name"
              />
            </div>
            <div className="form-group">
              <label htmlFor="joinCode">Join Code</label>
              <input
                id="joinCode"
                className="input"
                type="text"
                placeholder="e.g. ABC123"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                style={{ textTransform: 'uppercase', letterSpacing: '0.15em', textAlign: 'center', fontWeight: 600 }}
              />
            </div>
            <button className="btn btn-primary" type="submit" disabled={loading}>
              {loading ? <span className="spinner" /> : 'Join Session'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleProfessorLogin}>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.5rem', lineHeight: 1.5 }}>
              Access the professor dashboard to manage cases, assignments, directives, and view student conversation logs.
            </p>
            <button className="btn btn-accent" type="submit" disabled={loading}>
              {loading ? <span className="spinner" /> : 'Enter Dashboard'}
            </button>
          </form>
        )}

        <div className="landing-divider">CaseCoach AI</div>

        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
          AI-powered case coaching with structured executive hierarchy.<br />
          Your conversations are logged for academic review.
        </p>
      </div>
    </div>
  );
}

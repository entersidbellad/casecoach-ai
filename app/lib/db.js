import Database from 'better-sqlite3';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const DB_PATH = path.join(process.cwd(), 'data', 'fccp.db');

let _db = null;

export function getDb() {
    if (_db) return _db;

    // Ensure data directory exists
    const fs = require('fs');
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    _db = new Database(DB_PATH);
    _db.pragma('journal_mode = WAL');
    _db.pragma('foreign_keys = ON');

    // Create tables
    _db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      email       TEXT,
      role        TEXT NOT NULL CHECK(role IN ('professor','student')),
      created_at  TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS cases (
      id          TEXT PRIMARY KEY,
      title       TEXT NOT NULL,
      pdf_text    TEXT,
      kpis        TEXT,
      red_lines   TEXT,
      goals       TEXT,
      created_by  TEXT REFERENCES users(id),
      created_at  TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS assignments (
      id          TEXT PRIMARY KEY,
      case_id     TEXT REFERENCES cases(id),
      title       TEXT NOT NULL,
      join_code   TEXT UNIQUE,
      credits     INTEGER DEFAULT 25,
      created_by  TEXT REFERENCES users(id),
      active      INTEGER DEFAULT 1,
      created_at  TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id            TEXT PRIMARY KEY,
      user_id       TEXT REFERENCES users(id),
      assignment_id TEXT REFERENCES assignments(id),
      credits_used  INTEGER DEFAULT 0,
      created_at    TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS messages (
      id          TEXT PRIMARY KEY,
      session_id  TEXT REFERENCES sessions(id),
      role        TEXT CHECK(role IN ('student','system')),
      content     TEXT,
      agent_trace TEXT,
      phase       TEXT,
      created_at  TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS directives (
      id            TEXT PRIMARY KEY,
      assignment_id TEXT REFERENCES assignments(id),
      content       TEXT NOT NULL,
      active        INTEGER DEFAULT 1,
      created_by    TEXT REFERENCES users(id),
      created_at    TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS agent_overrides (
      id            TEXT PRIMARY KEY,
      case_id       TEXT REFERENCES cases(id),
      agent_name    TEXT NOT NULL,
      prompt_addition TEXT,
      created_by    TEXT REFERENCES users(id)
    );
  `);

    return _db;
}

// --- User helpers ---

export function createUser({ name, email, role }) {
    const db = getDb();
    const id = uuidv4();
    db.prepare('INSERT INTO users (id, name, email, role) VALUES (?, ?, ?, ?)')
        .run(id, name, email || null, role);
    return { id, name, email, role };
}

export function getUserById(id) {
    return getDb().prepare('SELECT * FROM users WHERE id = ?').get(id);
}

export function getUsersByRole(role) {
    return getDb().prepare('SELECT * FROM users WHERE role = ?').all(role);
}

// --- Case helpers ---

export function createCase({ title, pdf_text, kpis, red_lines, goals, created_by }) {
    const db = getDb();
    const id = uuidv4();
    db.prepare(
        'INSERT INTO cases (id, title, pdf_text, kpis, red_lines, goals, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(id, title, pdf_text || null, JSON.stringify(kpis || {}), JSON.stringify(red_lines || []), JSON.stringify(goals || {}), created_by);
    return { id, title };
}

export function getCaseById(id) {
    const row = getDb().prepare('SELECT * FROM cases WHERE id = ?').get(id);
    if (!row) return null;
    return {
        ...row,
        kpis: JSON.parse(row.kpis || '{}'),
        red_lines: JSON.parse(row.red_lines || '[]'),
        goals: JSON.parse(row.goals || '{}')
    };
}

export function getAllCases() {
    return getDb().prepare('SELECT id, title, created_at FROM cases ORDER BY created_at DESC').all();
}

export function updateCase(id, updates = {}) {
    const db = getDb();
    const existing = getCaseById(id);
    if (!existing) return;
    const title = updates.title !== undefined ? updates.title : existing.title;
    const pdf_text = updates.pdf_text !== undefined ? updates.pdf_text : existing.pdf_text;
    const kpis = updates.kpis !== undefined ? updates.kpis : existing.kpis;
    const red_lines = updates.red_lines !== undefined ? updates.red_lines : existing.red_lines;
    const goals = updates.goals !== undefined ? updates.goals : existing.goals;
    db.prepare(
        'UPDATE cases SET title = ?, pdf_text = ?, kpis = ?, red_lines = ?, goals = ? WHERE id = ?'
    ).run(title, pdf_text, JSON.stringify(kpis || {}), JSON.stringify(red_lines || []), JSON.stringify(goals || {}), id);
}

// --- Assignment helpers ---

export function createAssignment({ case_id, title, credits, created_by }) {
    const db = getDb();
    const id = uuidv4();
    const join_code = Math.random().toString(36).substring(2, 8).toUpperCase();
    db.prepare(
        'INSERT INTO assignments (id, case_id, title, join_code, credits, created_by) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(id, case_id, title, join_code, credits || 25, created_by);
    return { id, join_code, title };
}

export function getAssignmentByJoinCode(code) {
    const row = getDb().prepare('SELECT * FROM assignments WHERE join_code = ? AND active = 1').get(code);
    return row || null;
}

export function getAssignmentById(id) {
    return getDb().prepare('SELECT * FROM assignments WHERE id = ?').get(id) || null;
}

export function getAssignmentsByProfessor(professorId) {
    return getDb().prepare(
        'SELECT a.*, c.title as case_title FROM assignments a LEFT JOIN cases c ON a.case_id = c.id WHERE a.created_by = ? ORDER BY a.created_at DESC'
    ).all(professorId);
}

// --- Session helpers ---

export function createSession({ user_id, assignment_id }) {
    const db = getDb();
    const id = uuidv4();
    db.prepare('INSERT INTO sessions (id, user_id, assignment_id) VALUES (?, ?, ?)').run(id, user_id, assignment_id);
    return { id, user_id, assignment_id, credits_used: 0 };
}

export function getSessionById(id) {
    return getDb().prepare('SELECT * FROM sessions WHERE id = ?').get(id) || null;
}

export function getSessionsByAssignment(assignmentId) {
    return getDb().prepare(
        'SELECT s.*, u.name as student_name FROM sessions s LEFT JOIN users u ON s.user_id = u.id WHERE s.assignment_id = ? ORDER BY s.created_at DESC'
    ).all(assignmentId);
}

export function incrementCredits(sessionId) {
    getDb().prepare('UPDATE sessions SET credits_used = credits_used + 1 WHERE id = ?').run(sessionId);
}

export function getCreditsRemaining(sessionId) {
    const session = getSessionById(sessionId);
    if (!session) return 0;
    const assignment = getAssignmentById(session.assignment_id);
    if (!assignment) return 0;
    return Math.max(0, assignment.credits - session.credits_used);
}

// --- Message helpers ---

export function saveMessage({ session_id, role, content, agent_trace, phase }) {
    const db = getDb();
    const id = uuidv4();
    db.prepare(
        'INSERT INTO messages (id, session_id, role, content, agent_trace, phase) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(id, session_id, role, content, agent_trace ? JSON.stringify(agent_trace) : null, phase || null);
    return { id };
}

export function getMessagesBySession(sessionId) {
    const rows = getDb().prepare('SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC').all(sessionId);
    return rows.map(r => ({
        ...r,
        agent_trace: r.agent_trace ? JSON.parse(r.agent_trace) : null
    }));
}

export function getMessagesByAssignment(assignmentId) {
    return getDb().prepare(`
    SELECT m.*, s.user_id, u.name as student_name
    FROM messages m
    JOIN sessions s ON m.session_id = s.id
    LEFT JOIN users u ON s.user_id = u.id
    WHERE s.assignment_id = ?
    ORDER BY m.created_at DESC
  `).all(assignmentId);
}

// --- Directive helpers ---

export function createDirective({ assignment_id, content, created_by }) {
    const db = getDb();
    const id = uuidv4();
    db.prepare('INSERT INTO directives (id, assignment_id, content, created_by) VALUES (?, ?, ?, ?)').run(id, assignment_id, content, created_by);
    return { id, content };
}

export function getActiveDirectives(assignmentId) {
    return getDb().prepare('SELECT * FROM directives WHERE assignment_id = ? AND active = 1 ORDER BY created_at DESC').all(assignmentId);
}

export function deactivateDirective(id) {
    getDb().prepare('UPDATE directives SET active = 0 WHERE id = ?').run(id);
}

// --- Agent Override helpers ---

export function setAgentOverride({ case_id, agent_name, prompt_addition, created_by }) {
    const db = getDb();
    const existing = db.prepare('SELECT id FROM agent_overrides WHERE case_id = ? AND agent_name = ?').get(case_id, agent_name);
    if (existing) {
        db.prepare('UPDATE agent_overrides SET prompt_addition = ? WHERE id = ?').run(prompt_addition, existing.id);
        return existing;
    }
    const id = uuidv4();
    db.prepare('INSERT INTO agent_overrides (id, case_id, agent_name, prompt_addition, created_by) VALUES (?, ?, ?, ?, ?)').run(id, case_id, agent_name, prompt_addition, created_by);
    return { id };
}

export function getAgentOverrides(caseId) {
    return getDb().prepare('SELECT * FROM agent_overrides WHERE case_id = ?').all(caseId);
}

// --- Seed demo data ---

export function seedDemoData() {
    const db = getDb();
    const existing = db.prepare('SELECT id FROM users WHERE role = ?').get('professor');
    if (existing) return; // Already seeded

    const prof = createUser({ name: 'Demo Professor', email: 'professor@demo.com', role: 'professor' });

    const caseData = createCase({
        title: 'Apex Health Plan (Medicare Advantage)',
        pdf_text: null,
        kpis: {
            mlr_current: 91,
            mlr_target: 87,
            admissions_per_1000_current: 120,
            admissions_per_1000_benchmark: 105,
            hcc_gap_pct: '6-8',
            members: 165000,
            revenue_billion: 2.1,
            ebitda_margin_pct: 3,
            budget_million: '12-18'
        },
        red_lines: [
            'No compliance risk or aggressive coding tactics',
            'No provider revolt or unilateral rate cuts',
            'No heavy member abrasion',
            'No long-payback investments without measurable 6-12 month impact'
        ],
        goals: {
            margin_bps_target: '150-250',
            adherence_improvement_pct: '3-5',
            gap_closure_pct: '2'
        },
        created_by: prof.id
    });

    createAssignment({
        case_id: caseData.id,
        title: 'Spring 2026 — Apex Health Analysis',
        credits: 25,
        created_by: prof.id
    });
}

import { createClient } from '@libsql/client';
import { v4 as uuidv4 } from 'uuid';

let _client = null;

export function getDb() {
    if (_client) return _client;

    const url = process.env.TURSO_DATABASE_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;

    if (!url) {
        throw new Error('TURSO_DATABASE_URL environment variable is not set. Please configure it in your Vercel project settings.');
    }

    _client = createClient({ url, authToken });

    return _client;
}

// Initialize tables
export async function initDb() {
    const db = getDb();
    await db.executeMultiple(`
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
}

// Ensure DB is initialized (called once per cold start)
let _initPromise = null;
export async function ensureDb() {
    if (!_initPromise) {
        _initPromise = initDb();
    }
    await _initPromise;
    return getDb();
}

// --- User helpers ---

export async function createUser({ name, email, role }) {
    const db = await ensureDb();
    const id = uuidv4();
    await db.execute({
        sql: 'INSERT INTO users (id, name, email, role) VALUES (?, ?, ?, ?)',
        args: [id, name, email || null, role]
    });
    return { id, name, email, role };
}

export async function getUserById(id) {
    const db = await ensureDb();
    const result = await db.execute({ sql: 'SELECT * FROM users WHERE id = ?', args: [id] });
    return result.rows[0] || null;
}

export async function getUsersByRole(role) {
    const db = await ensureDb();
    const result = await db.execute({ sql: 'SELECT * FROM users WHERE role = ?', args: [role] });
    return result.rows;
}

// --- Case helpers ---

export async function createCase({ title, pdf_text, kpis, red_lines, goals, created_by }) {
    const db = await ensureDb();
    const id = uuidv4();
    await db.execute({
        sql: 'INSERT INTO cases (id, title, pdf_text, kpis, red_lines, goals, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
        args: [id, title, pdf_text || null, JSON.stringify(kpis || {}), JSON.stringify(red_lines || []), JSON.stringify(goals || {}), created_by]
    });
    return { id, title };
}

export async function getCaseById(id) {
    const db = await ensureDb();
    const result = await db.execute({ sql: 'SELECT * FROM cases WHERE id = ?', args: [id] });
    const row = result.rows[0];
    if (!row) return null;
    return {
        ...row,
        kpis: JSON.parse(row.kpis || '{}'),
        red_lines: JSON.parse(row.red_lines || '[]'),
        goals: JSON.parse(row.goals || '{}')
    };
}

export async function getAllCases() {
    const db = await ensureDb();
    const result = await db.execute('SELECT id, title, created_at FROM cases ORDER BY created_at DESC');
    return result.rows;
}

export async function updateCase(id, updates = {}) {
    const db = await ensureDb();
    const existing = await getCaseById(id);
    if (!existing) return;
    const title = updates.title !== undefined ? updates.title : existing.title;
    const pdf_text = updates.pdf_text !== undefined ? updates.pdf_text : existing.pdf_text;
    const kpis = updates.kpis !== undefined ? updates.kpis : existing.kpis;
    const red_lines = updates.red_lines !== undefined ? updates.red_lines : existing.red_lines;
    const goals = updates.goals !== undefined ? updates.goals : existing.goals;
    await db.execute({
        sql: 'UPDATE cases SET title = ?, pdf_text = ?, kpis = ?, red_lines = ?, goals = ? WHERE id = ?',
        args: [title, pdf_text, JSON.stringify(kpis || {}), JSON.stringify(red_lines || []), JSON.stringify(goals || {}), id]
    });
}

// --- Assignment helpers ---

export async function createAssignment({ case_id, title, credits, created_by }) {
    const db = await ensureDb();
    const id = uuidv4();
    const join_code = Math.random().toString(36).substring(2, 8).toUpperCase();
    await db.execute({
        sql: 'INSERT INTO assignments (id, case_id, title, join_code, credits, created_by) VALUES (?, ?, ?, ?, ?, ?)',
        args: [id, case_id, title, join_code, credits || 25, created_by]
    });
    return { id, join_code, title };
}

export async function getAssignmentByJoinCode(code) {
    const db = await ensureDb();
    const result = await db.execute({ sql: 'SELECT * FROM assignments WHERE join_code = ? AND active = 1', args: [code] });
    return result.rows[0] || null;
}

export async function getAssignmentById(id) {
    const db = await ensureDb();
    const result = await db.execute({ sql: 'SELECT * FROM assignments WHERE id = ?', args: [id] });
    return result.rows[0] || null;
}

export async function getAssignmentsByProfessor(professorId) {
    const db = await ensureDb();
    const result = await db.execute({
        sql: 'SELECT a.*, c.title as case_title FROM assignments a LEFT JOIN cases c ON a.case_id = c.id WHERE a.created_by = ? ORDER BY a.created_at DESC',
        args: [professorId]
    });
    return result.rows;
}

// --- Session helpers ---

export async function createSession({ user_id, assignment_id }) {
    const db = await ensureDb();
    const id = uuidv4();
    await db.execute({
        sql: 'INSERT INTO sessions (id, user_id, assignment_id) VALUES (?, ?, ?)',
        args: [id, user_id, assignment_id]
    });
    return { id, user_id, assignment_id, credits_used: 0 };
}

export async function getSessionById(id) {
    const db = await ensureDb();
    const result = await db.execute({ sql: 'SELECT * FROM sessions WHERE id = ?', args: [id] });
    return result.rows[0] || null;
}

export async function getSessionsByAssignment(assignmentId) {
    const db = await ensureDb();
    const result = await db.execute({
        sql: 'SELECT s.*, u.name as student_name FROM sessions s LEFT JOIN users u ON s.user_id = u.id WHERE s.assignment_id = ? ORDER BY s.created_at DESC',
        args: [assignmentId]
    });
    return result.rows;
}

export async function incrementCredits(sessionId) {
    const db = await ensureDb();
    await db.execute({
        sql: 'UPDATE sessions SET credits_used = credits_used + 1 WHERE id = ?',
        args: [sessionId]
    });
}

export async function getCreditsRemaining(sessionId) {
    const session = await getSessionById(sessionId);
    if (!session) return 0;
    const assignment = await getAssignmentById(session.assignment_id);
    if (!assignment) return 0;
    return Math.max(0, assignment.credits - session.credits_used);
}

// --- Message helpers ---

export async function saveMessage({ session_id, role, content, agent_trace, phase }) {
    const db = await ensureDb();
    const id = uuidv4();
    await db.execute({
        sql: 'INSERT INTO messages (id, session_id, role, content, agent_trace, phase) VALUES (?, ?, ?, ?, ?, ?)',
        args: [id, session_id, role, content, agent_trace ? JSON.stringify(agent_trace) : null, phase || null]
    });
    return { id };
}

export async function getMessagesBySession(sessionId) {
    const db = await ensureDb();
    const result = await db.execute({
        sql: 'SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC',
        args: [sessionId]
    });
    return result.rows.map(r => ({
        ...r,
        agent_trace: r.agent_trace ? JSON.parse(r.agent_trace) : null
    }));
}

export async function getMessagesByAssignment(assignmentId) {
    const db = await ensureDb();
    const result = await db.execute({
        sql: `SELECT m.*, s.user_id, u.name as student_name
              FROM messages m
              JOIN sessions s ON m.session_id = s.id
              LEFT JOIN users u ON s.user_id = u.id
              WHERE s.assignment_id = ?
              ORDER BY m.created_at DESC`,
        args: [assignmentId]
    });
    return result.rows;
}

// --- Directive helpers ---

export async function createDirective({ assignment_id, content, created_by }) {
    const db = await ensureDb();
    const id = uuidv4();
    await db.execute({
        sql: 'INSERT INTO directives (id, assignment_id, content, created_by) VALUES (?, ?, ?, ?)',
        args: [id, assignment_id, content, created_by]
    });
    return { id, content };
}

export async function getActiveDirectives(assignmentId) {
    const db = await ensureDb();
    const result = await db.execute({
        sql: 'SELECT * FROM directives WHERE assignment_id = ? AND active = 1 ORDER BY created_at DESC',
        args: [assignmentId]
    });
    return result.rows;
}

export async function deactivateDirective(id) {
    const db = await ensureDb();
    await db.execute({ sql: 'UPDATE directives SET active = 0 WHERE id = ?', args: [id] });
}

// --- Agent Override helpers ---

export async function setAgentOverride({ case_id, agent_name, prompt_addition, created_by }) {
    const db = await ensureDb();
    const existing = await db.execute({
        sql: 'SELECT id FROM agent_overrides WHERE case_id = ? AND agent_name = ?',
        args: [case_id, agent_name]
    });
    if (existing.rows[0]) {
        await db.execute({
            sql: 'UPDATE agent_overrides SET prompt_addition = ? WHERE id = ?',
            args: [prompt_addition, existing.rows[0].id]
        });
        return existing.rows[0];
    }
    const id = uuidv4();
    await db.execute({
        sql: 'INSERT INTO agent_overrides (id, case_id, agent_name, prompt_addition, created_by) VALUES (?, ?, ?, ?, ?)',
        args: [id, case_id, agent_name, prompt_addition, created_by]
    });
    return { id };
}

export async function getAgentOverrides(caseId) {
    const db = await ensureDb();
    const result = await db.execute({
        sql: 'SELECT * FROM agent_overrides WHERE case_id = ?',
        args: [caseId]
    });
    return result.rows;
}

// --- Seed demo data ---

export async function seedDemoData() {
    const db = await ensureDb();
    const existing = await db.execute({ sql: "SELECT id FROM users WHERE role = 'professor' LIMIT 1", args: [] });
    if (existing.rows.length > 0) return; // Already seeded

    const prof = await createUser({ name: 'Demo Professor', email: 'professor@demo.com', role: 'professor' });

    const caseData = await createCase({
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

    await createAssignment({
        case_id: caseData.id,
        title: 'Spring 2026 — Apex Health Analysis',
        credits: 25,
        created_by: prof.id
    });
}

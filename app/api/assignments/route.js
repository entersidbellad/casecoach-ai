// /api/assignments — CRUD for assignment management
import { NextResponse } from 'next/server';
import {
    createAssignment,
    getAssignmentsByProfessor,
    getAssignmentById,
    getAllCases,
    getCaseById,
    getUsersByRole,
    ensureDb
} from '@/app/lib/db';

// GET — list assignments for professor or get single assignment
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (id) {
            const assignment = await getAssignmentById(id);
            if (!assignment) return NextResponse.json({ error: 'Not found' }, { status: 404 });
            const caseData = assignment.case_id ? await getCaseById(assignment.case_id) : null;
            return NextResponse.json({ assignment, case: caseData });
        }

        // List all — we need to find the professor
        const professors = await getUsersByRole('professor');
        if (professors.length === 0) {
            return NextResponse.json({ assignments: [], cases: [] });
        }
        const prof = professors[0];
        const assignments = await getAssignmentsByProfessor(prof.id);
        const cases = await getAllCases();
        return NextResponse.json({ assignments, cases });
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// POST — create a new assignment
export async function POST(request) {
    try {
        const body = await request.json();
        const { case_id, title, credits } = body;

        if (!case_id || !title?.trim()) {
            return NextResponse.json({ error: 'case_id and title are required' }, { status: 400 });
        }

        // Verify case exists
        const caseData = await getCaseById(case_id);
        if (!caseData) {
            return NextResponse.json({ error: 'Case not found' }, { status: 404 });
        }

        // Get professor (first one for MVP)
        const professors = await getUsersByRole('professor');
        if (professors.length === 0) {
            return NextResponse.json({ error: 'No professor found. Seed demo data first.' }, { status: 400 });
        }

        const result = await createAssignment({
            case_id,
            title: title.trim(),
            credits: credits || 25,
            created_by: professors[0].id
        });

        return NextResponse.json({
            assignment: result,
            message: `Assignment created with join code: ${result.join_code}`
        }, { status: 201 });
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// PUT — update assignment (toggle active, update credits)
export async function PUT(request) {
    try {
        const body = await request.json();
        const { id, active, credits } = body;

        if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

        const assignment = await getAssignmentById(id);
        if (!assignment) return NextResponse.json({ error: 'Not found' }, { status: 404 });

        const db = await ensureDb();
        const updates = [];
        const values = [];
        if (active !== undefined) { updates.push('active = ?'); values.push(active ? 1 : 0); }
        if (credits !== undefined) { updates.push('credits = ?'); values.push(credits); }

        if (updates.length > 0) {
            values.push(id);
            await db.execute({
                sql: `UPDATE assignments SET ${updates.join(', ')} WHERE id = ?`,
                args: values
            });
        }

        return NextResponse.json({ success: true });
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

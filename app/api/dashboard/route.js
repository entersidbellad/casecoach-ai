// Professor dashboard API — returns all data for the professor view
import { NextResponse } from 'next/server';
import {
    getUsersByRole,
    getAssignmentsByProfessor,
    getAllCases,
    getSessionsByAssignment,
    getActiveDirectives
} from '@/app/lib/db';

export async function GET() {
    try {
        const professors = await getUsersByRole('professor');
        const prof = professors[0];

        if (!prof) {
            return NextResponse.json({ error: 'No professor found. Please seed data first.' }, { status: 404 });
        }

        const assignments = await getAssignmentsByProfessor(prof.id);
        const cases = await getAllCases();

        // Enrich assignments with session counts and directives
        const enrichedAssignments = [];
        for (const a of assignments) {
            const sessions = await getSessionsByAssignment(a.id);
            const directives = await getActiveDirectives(a.id);
            enrichedAssignments.push({
                ...a,
                student_count: sessions.length,
                total_turns: sessions.reduce((sum, s) => sum + (s.credits_used || 0), 0),
                active_directives: directives.length,
                sessions: sessions.map(s => ({
                    id: s.id,
                    student_name: s.student_name,
                    credits_used: s.credits_used,
                    created_at: s.created_at
                }))
            });
        }

        return NextResponse.json({
            professor: { id: prof.id, name: prof.name },
            assignments: enrichedAssignments,
            cases
        });
    } catch (err) {
        console.error('Dashboard API error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

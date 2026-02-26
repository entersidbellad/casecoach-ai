// Professor dashboard API — returns all data for the professor view
import { NextResponse } from 'next/server';
import {
    getUsersByRole,
    getAssignmentsByProfessor,
    getAllCases,
    getSessionsByAssignment,
    getMessagesByAssignment,
    getActiveDirectives
} from '@/app/lib/db';

export async function GET() {
    try {
        const professors = getUsersByRole('professor');
        const prof = professors[0];

        if (!prof) {
            return NextResponse.json({ error: 'No professor found. Please seed data first.' }, { status: 404 });
        }

        const assignments = getAssignmentsByProfessor(prof.id);
        const cases = getAllCases();

        // Enrich assignments with session counts and directives
        const enrichedAssignments = assignments.map(a => {
            const sessions = getSessionsByAssignment(a.id);
            const directives = getActiveDirectives(a.id);
            return {
                ...a,
                student_count: sessions.length,
                total_turns: sessions.reduce((sum, s) => sum + s.credits_used, 0),
                active_directives: directives.length,
                sessions: sessions.map(s => ({
                    id: s.id,
                    student_name: s.student_name,
                    credits_used: s.credits_used,
                    created_at: s.created_at
                }))
            };
        });

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

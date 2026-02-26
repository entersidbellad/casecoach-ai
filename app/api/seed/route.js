// /api/seed — Seeds demo data (dev only)
import { NextResponse } from 'next/server';
import { seedDemoData, getUsersByRole, getAssignmentsByProfessor } from '@/app/lib/db';

export async function POST() {
    try {
        seedDemoData();

        const professors = getUsersByRole('professor');
        const prof = professors[0];
        const assignments = prof ? getAssignmentsByProfessor(prof.id) : [];

        return NextResponse.json({
            message: 'Demo data seeded successfully',
            professor: prof ? { id: prof.id, name: prof.name } : null,
            assignments: assignments.map(a => ({
                id: a.id,
                title: a.title,
                join_code: a.join_code,
                credits: a.credits
            }))
        });
    } catch (err) {
        console.error('Seed error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

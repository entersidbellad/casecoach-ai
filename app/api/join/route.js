// POST /api/join — Student joins an assignment via code
import { NextResponse } from 'next/server';
import { getAssignmentByJoinCode, createUser, createSession } from '@/app/lib/db';

export async function POST(request) {
    try {
        const body = await request.json();
        const { join_code, student_name } = body;

        if (!join_code || !join_code.trim()) {
            return NextResponse.json({ error: 'Join code is required' }, { status: 400 });
        }
        if (!student_name || !student_name.trim()) {
            return NextResponse.json({ error: 'Student name is required' }, { status: 400 });
        }

        const assignment = await getAssignmentByJoinCode(join_code.trim().toUpperCase());
        if (!assignment) {
            return NextResponse.json({ error: 'Invalid join code. Please check and try again.' }, { status: 404 });
        }

        // Create student user and session
        const student = await createUser({
            name: student_name.trim(),
            role: 'student'
        });

        const session = await createSession({
            user_id: student.id,
            assignment_id: assignment.id
        });

        return NextResponse.json({
            session_id: session.id,
            assignment_title: assignment.title,
            credits: assignment.credits,
            student_name: student.name
        });
    } catch (err) {
        console.error('Join API error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

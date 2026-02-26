// Professor logs API — returns conversation logs for an assignment
import { NextResponse } from 'next/server';
import { getMessagesByAssignment } from '@/app/lib/db';

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const assignment_id = searchParams.get('assignment_id');

        if (!assignment_id) {
            return NextResponse.json({ error: 'assignment_id is required' }, { status: 400 });
        }

        const messages = getMessagesByAssignment(assignment_id);

        // Parse agent_trace for system messages
        const enriched = messages.map(m => ({
            ...m,
            agent_trace: m.agent_trace ? JSON.parse(m.agent_trace) : null
        }));

        return NextResponse.json({ messages: enriched });
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// /api/session-reset — Reset a student session's coaching state
import { NextResponse } from 'next/server';
import { getDb } from '@/app/lib/db';

export async function POST(request) {
    try {
        const { session_id } = await request.json();
        if (!session_id) {
            return NextResponse.json({ error: 'session_id is required' }, { status: 400 });
        }

        const db = getDb();

        // Verify session exists
        const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(session_id);
        if (!session) {
            return NextResponse.json({ error: 'Session not found' }, { status: 404 });
        }

        // Delete all messages for this session
        const result = db.prepare('DELETE FROM messages WHERE session_id = ?').run(session_id);

        // Reset credits used
        db.prepare('UPDATE sessions SET credits_used = 0 WHERE id = ?').run(session_id);

        return NextResponse.json({
            success: true,
            messages_deleted: result.changes,
            message: 'Session reset successfully. You can start your analysis fresh.'
        });
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

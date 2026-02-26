// /api/session-reset — Reset a student session's coaching state
import { NextResponse } from 'next/server';
import { ensureDb } from '@/app/lib/db';

export async function POST(request) {
    try {
        const { session_id } = await request.json();
        if (!session_id) {
            return NextResponse.json({ error: 'session_id is required' }, { status: 400 });
        }

        const db = await ensureDb();

        // Verify session exists
        const sessionResult = await db.execute({ sql: 'SELECT * FROM sessions WHERE id = ?', args: [session_id] });
        if (!sessionResult.rows[0]) {
            return NextResponse.json({ error: 'Session not found' }, { status: 404 });
        }

        // Delete all messages for this session
        const result = await db.execute({ sql: 'DELETE FROM messages WHERE session_id = ?', args: [session_id] });

        // Reset credits used
        await db.execute({ sql: 'UPDATE sessions SET credits_used = 0 WHERE id = ?', args: [session_id] });

        return NextResponse.json({
            success: true,
            messages_deleted: result.rowsAffected,
            message: 'Session reset successfully. You can start your analysis fresh.'
        });
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

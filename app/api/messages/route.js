// /api/messages — Get conversation history for a session
import { NextResponse } from 'next/server';
import { getMessagesBySession } from '@/app/lib/db';

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const session_id = searchParams.get('session_id');

        if (!session_id) {
            return NextResponse.json({ error: 'session_id is required' }, { status: 400 });
        }

        const messages = getMessagesBySession(session_id);
        return NextResponse.json({ messages });
    } catch (err) {
        console.error('Messages API error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

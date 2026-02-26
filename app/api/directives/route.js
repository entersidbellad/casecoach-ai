// Professor directives API
import { NextResponse } from 'next/server';
import {
    createDirective,
    getActiveDirectives,
    deactivateDirective,
    getUsersByRole
} from '@/app/lib/db';

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const assignment_id = searchParams.get('assignment_id');

        if (!assignment_id) {
            return NextResponse.json({ error: 'assignment_id is required' }, { status: 400 });
        }

        const directives = getActiveDirectives(assignment_id);
        return NextResponse.json({ directives });
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function POST(request) {
    try {
        const body = await request.json();
        const { assignment_id, content } = body;

        if (!assignment_id || !content?.trim()) {
            return NextResponse.json({ error: 'assignment_id and content are required' }, { status: 400 });
        }

        const professors = getUsersByRole('professor');
        const prof = professors[0];

        const directive = createDirective({
            assignment_id,
            content: content.trim(),
            created_by: prof?.id
        });

        return NextResponse.json({ directive });
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function DELETE(request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'id is required' }, { status: 400 });
        }

        deactivateDirective(id);
        return NextResponse.json({ success: true });
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

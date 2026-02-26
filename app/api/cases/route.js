// Cases API — CRUD for case management
import { NextResponse } from 'next/server';
import {
    getAllCases,
    getCaseById,
    updateCase,
    createCase,
    getUsersByRole,
    setAgentOverride,
    getAgentOverrides
} from '@/app/lib/db';

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (id) {
            const caseData = getCaseById(id);
            if (!caseData) {
                return NextResponse.json({ error: 'Case not found' }, { status: 404 });
            }
            const overrides = getAgentOverrides(id);
            return NextResponse.json({ case: caseData, overrides });
        }

        const cases = getAllCases();
        return NextResponse.json({ cases });
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function PUT(request) {
    try {
        const body = await request.json();
        const { id, title, kpis, red_lines, goals, pdf_text, agent_overrides } = body;

        if (!id) {
            return NextResponse.json({ error: 'Case id is required' }, { status: 400 });
        }

        const existing = getCaseById(id);
        if (!existing) {
            return NextResponse.json({ error: 'Case not found' }, { status: 404 });
        }

        updateCase(id, {
            title: title || existing.title,
            pdf_text: pdf_text !== undefined ? pdf_text : existing.pdf_text,
            kpis: kpis || existing.kpis,
            red_lines: red_lines || existing.red_lines,
            goals: goals || existing.goals
        });

        // Handle agent overrides
        if (agent_overrides && Array.isArray(agent_overrides)) {
            const professors = getUsersByRole('professor');
            const prof = professors[0];
            for (const override of agent_overrides) {
                if (override.agent_name && override.prompt_addition !== undefined) {
                    setAgentOverride({
                        case_id: id,
                        agent_name: override.agent_name,
                        prompt_addition: override.prompt_addition,
                        created_by: prof?.id
                    });
                }
            }
        }

        return NextResponse.json({ success: true, message: 'Case updated' });
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

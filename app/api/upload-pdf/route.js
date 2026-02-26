// POST /api/upload-pdf — Professor uploads a PDF case file
import { NextResponse } from 'next/server';
import { extractTextFromPDF } from '@/app/lib/pdf-extractor';
import { createCase, updateCase, getUsersByRole } from '@/app/lib/db';

export async function POST(request) {
    try {
        const formData = await request.formData();
        const file = formData.get('pdf');
        const title = formData.get('title');
        const caseId = formData.get('case_id'); // if updating existing case

        if (!file) {
            return NextResponse.json({ error: 'No PDF file provided' }, { status: 400 });
        }

        if (!title && !caseId) {
            return NextResponse.json({ error: 'Title is required for new cases' }, { status: 400 });
        }

        // Read PDF buffer
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // Extract text
        const result = await extractTextFromPDF(buffer);

        if (!result.text || result.text.trim().length === 0) {
            return NextResponse.json({
                error: 'Could not extract text from PDF. The file may be scanned/image-based.'
            }, { status: 422 });
        }

        const professors = getUsersByRole('professor');
        const prof = professors[0];

        if (caseId) {
            // Update existing case with new PDF text
            updateCase(caseId, {
                title: title || undefined,
                pdf_text: result.text
            });
            return NextResponse.json({
                case_id: caseId,
                pages: result.pages,
                text_length: result.text.length,
                preview: result.text.substring(0, 300) + '...',
                message: 'Case updated with new PDF text'
            });
        }

        // Create new case
        const newCase = createCase({
            title: title.trim(),
            pdf_text: result.text,
            kpis: {},
            red_lines: [],
            goals: {},
            created_by: prof?.id
        });

        return NextResponse.json({
            case_id: newCase.id,
            title: newCase.title,
            pages: result.pages,
            text_length: result.text.length,
            preview: result.text.substring(0, 300) + '...',
            message: 'Case created successfully'
        });
    } catch (err) {
        console.error('PDF upload error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

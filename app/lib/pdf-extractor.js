// PDF text extraction utility
import pdf from 'pdf-parse';

export async function extractTextFromPDF(buffer) {
    try {
        const data = await pdf(buffer);
        return {
            text: data.text || '',
            pages: data.numpages || 0,
            info: data.info || {}
        };
    } catch (err) {
        console.error('PDF extraction failed:', err);
        throw new Error('Failed to extract text from PDF. Please ensure the file is a valid PDF.');
    }
}

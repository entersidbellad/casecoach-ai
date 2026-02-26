// /api/analytics — Professor analytics for coaching performance
import { NextResponse } from 'next/server';
import { getDb } from '@/app/lib/db';

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const assignmentId = searchParams.get('assignment_id');
        const db = getDb();

        // Overall stats
        const totalSessions = db.prepare('SELECT COUNT(*) as count FROM sessions').get().count;
        const totalMessages = db.prepare('SELECT COUNT(*) as count FROM messages').get().count;
        const totalStudentMsgs = db.prepare("SELECT COUNT(*) as count FROM messages WHERE role = 'student'").get().count;

        // Phase distribution — how many messages in each phase
        const phaseDistribution = db.prepare(`
      SELECT phase, COUNT(*) as count 
      FROM messages 
      WHERE role = 'system' AND phase IS NOT NULL
      GROUP BY phase
    `).all();

        // Average turns to reach direction phase per session
        const sessionsWithDirection = db.prepare(`
      SELECT session_id, MIN(rowid) as first_direction_row
      FROM messages 
      WHERE phase = 'direction' AND role = 'system'
      GROUP BY session_id
    `).all();

        // Rubric scores — parse from message content/agent_trace
        const rubricMessages = db.prepare(`
      SELECT content, agent_trace, session_id
      FROM messages 
      WHERE role = 'system' AND phase = 'critique'
      ORDER BY created_at DESC
      LIMIT 100
    `).all();

        // Parse rubric scores from the critique messages
        const rubricScores = { problem_framing: [], evidence_use: [], tradeoff_quality: [], risk_compliance: [] };
        const scoreMap = { weak: 1, developing: 2, adequate: 3, strong: 4 };

        for (const msg of rubricMessages) {
            const content = msg.content || '';
            // Extract rubric scores from the formatted response
            for (const dim of Object.keys(rubricScores)) {
                const patterns = {
                    problem_framing: /problem\s*framing\*?\*?:\s*(weak|developing|adequate|strong)/i,
                    evidence_use: /evidence\s*use\*?\*?:\s*(weak|developing|adequate|strong)/i,
                    tradeoff_quality: /tradeoff\s*quality\*?\*?:\s*(weak|developing|adequate|strong)/i,
                    risk_compliance: /risk[\/&]?\s*compliance\*?\*?:\s*(weak|developing|adequate|strong)/i
                };
                const match = content.match(patterns[dim]);
                if (match) {
                    rubricScores[dim].push(scoreMap[match[1].toLowerCase()] || 0);
                }
            }
        }

        // Calculate averages
        const rubricAverages = {};
        for (const [dim, scores] of Object.entries(rubricScores)) {
            if (scores.length > 0) {
                const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
                rubricAverages[dim] = {
                    average: Math.round(avg * 100) / 100,
                    label: avg < 1.5 ? 'Weak' : avg < 2.5 ? 'Developing' : avg < 3.5 ? 'Adequate' : 'Strong',
                    count: scores.length
                };
            }
        }

        // Most common weak areas
        const weakAreas = Object.entries(rubricScores)
            .map(([dim, scores]) => ({
                dimension: dim.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
                weakCount: scores.filter(s => s <= 1).length,
                totalEvals: scores.length,
                weakPercent: scores.length > 0 ? Math.round((scores.filter(s => s <= 1).length / scores.length) * 100) : 0
            }))
            .sort((a, b) => b.weakPercent - a.weakPercent);

        // Per-session performance
        const sessionStats = db.prepare(`
      SELECT 
        s.id as session_id,
        u.name as student_name,
        s.credits_used,
        COUNT(m.id) as message_count,
        s.created_at
      FROM sessions s
      LEFT JOIN users u ON s.user_id = u.id
      LEFT JOIN messages m ON m.session_id = s.id
      ${assignmentId ? 'WHERE s.assignment_id = ?' : ''}
      GROUP BY s.id
      ORDER BY s.created_at DESC
    `).all(...(assignmentId ? [assignmentId] : []));

        return NextResponse.json({
            overview: {
                total_sessions: totalSessions,
                total_messages: totalMessages,
                total_student_messages: totalStudentMsgs,
                sessions_reaching_direction: sessionsWithDirection.length
            },
            phase_distribution: phaseDistribution,
            rubric_averages: rubricAverages,
            weak_areas: weakAreas,
            session_stats: sessionStats
        });
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

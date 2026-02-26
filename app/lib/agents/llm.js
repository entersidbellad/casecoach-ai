// LLM caller — supports AI Gateway, OpenAI, and OpenRouter APIs

export async function callLLM({ systemPrompt, userMessage, model = null }) {
    const apiKey = process.env.LLM_API_KEY || process.env.OPENAI_API_KEY || process.env.OPENROUTER_API_KEY;
    const baseUrl = process.env.LLM_BASE_URL || 'https://api.openai.com/v1';

    if (!apiKey || apiKey.includes('your_')) {
        return {
            content: generateFallbackResponse(systemPrompt, userMessage),
            model: 'fallback-no-key',
            tokens_used: 0
        };
    }

    const selectedModel = model || process.env.LLM_MODEL || 'gpt-4o-mini';
    const apiUrl = `${baseUrl}/chat/completions`;

    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
    };

    // Add OpenRouter-specific headers if using OpenRouter
    if (baseUrl.includes('openrouter')) {
        headers['HTTP-Referer'] = 'https://casecoach-ai.vercel.app';
        headers['X-Title'] = 'CaseCoach AI';
    }

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                model: selectedModel,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userMessage }
                ],
                max_tokens: 500,
                temperature: 0.7
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`LLM API error (${response.status}):`, errorText);

            let errorMsg = 'API error';
            try {
                const errorData = JSON.parse(errorText);
                errorMsg = errorData.error?.message || errorText;
            } catch (_) {
                errorMsg = errorText;
            }

            return {
                content: generateFallbackResponse(systemPrompt, userMessage),
                model: `fallback-${response.status}`,
                tokens_used: 0,
                error: errorMsg
            };
        }

        const data = await response.json();
        return {
            content: data.choices?.[0]?.message?.content || 'No response generated.',
            model: data.model || selectedModel,
            tokens_used: data.usage?.total_tokens || 0
        };
    } catch (err) {
        console.error('LLM call failed:', err.message);
        return {
            content: generateFallbackResponse(systemPrompt, userMessage),
            model: 'fallback-network-error',
            tokens_used: 0,
            error: err.message
        };
    }
}


// Rule-based fallback for when no API key is available or API fails
function generateFallbackResponse(systemPrompt, userMessage) {
    const lower = userMessage.toLowerCase();

    if (systemPrompt.includes('Chief Financial Officer')) {
        if (/\b(cost|budget|roi|margin|revenue)\b/.test(lower)) {
            return 'From a financial perspective, I need explicit cost and benefit assumptions with clear units (e.g., $5M, $900K) before I can evaluate ROI against our budget constraints and payback timeline. Please provide specific numbers.';
        }
        return 'I need quantified financial assumptions—cost, expected benefit, and timeline—to assess this proposal against our budget and ROI requirements.';
    }

    if (systemPrompt.includes('Chief Marketing Officer') || systemPrompt.includes('Chief Member Officer')) {
        if (/\b(provider|member|trust|satisfaction)\b/.test(lower)) {
            return 'This touches provider and member relationships. I recommend a phased approach with clear communication plans to stakeholders before implementation. Provider trust is essential and must be protected.';
        }
        return 'From a stakeholder perspective, we need to ensure any changes are communicated effectively and don\'t risk provider or member relationships. I recommend a phased rollout.';
    }

    if (systemPrompt.includes('Chief Medical Officer') && !systemPrompt.includes('Chief Marketing')) {
        if (/\b(safety|clinical|quality|compliance|patient)\b/.test(lower)) {
            return 'Clinical quality and patient safety are non-negotiable. Any proposed intervention needs evidence-based support and should be piloted before scaling. I recommend reviewing relevant quality benchmarks.';
        }
        return 'I need to evaluate the clinical implications of this proposal. Please ensure it aligns with quality standards and doesn\'t compromise patient safety or regulatory compliance.';
    }

    if (systemPrompt.includes('Chief Executive Officer')) {
        return 'After weighing all executive inputs, I recommend a measured approach. We should proceed with a limited pilot that addresses financial requirements while protecting clinical quality and stakeholder relationships. The biggest risk needs active monitoring with clear checkpoints.';
    }

    // Employee fallback
    if (/\b(approve|budget|invest|fund|decision)\b/.test(lower)) {
        return 'This requires executive review. I would flag this for CFO input on financial feasibility and CMO/CMedO input on stakeholder and clinical impact. Let me triage and escalate appropriately.';
    }
    return 'I can help scope the operational aspects. Let me assess what resources, timeline, and stakeholders are involved, and determine if executive sign-off is needed.';
}

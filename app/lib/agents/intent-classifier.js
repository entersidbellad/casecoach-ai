// Intent classification — determines which agents should activate
// Ported from the MVP with additions for the new architecture

const PHI_PATTERNS = {
    ssn: /\b\d{3}-\d{2}-\d{4}\b/,
    dob: /\b(?:dob|date of birth)\s*[:\-]?\s*(?:\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\b/i,
    mrn: /\bmrn\s*[:\-]?\s*[a-z0-9\-]{4,}\b/i,
    account: /\b(?:account|acct)\s*(?:number|no)?\s*[:\-]?\s*\d{8,}\b/i,
    fullNameDob: /\b[a-z]+\s+[a-z]+\b.*\b(?:dob|date of birth)\b/i
};

export function containsPHI(text = '') {
    const lower = text.toLowerCase();
    return Object.values(PHI_PATTERNS).some(pattern => pattern.test(lower));
}

export function classifyIntent(message = '') {
    const text = message.toLowerCase();

    if (containsPHI(text)) return 'phi_sensitive';
    if (/\b(urgent|escalate|immediate|critical|blocker|emergency|asap)\b/.test(text)) return 'escalation';
    if (/\b(should we|should|approve|go ahead|proceed|pursue|fund|funding|invest|decision|sustainability|strategy)\b/.test(text)) return 'exec_decision';
    if (/\b(policy|manual|document|sop|procedure|hipaa|compliance|regulation)\b/.test(text)) return 'compliance';
    if (/\b(budget|cost|roi|price|margin|revenue|profit|forecast|spend|pmpy|pmpm|ebitda|investment)\b/.test(text)) return 'financial';
    if (/\b(patient|clinical|triage|diagnosis|medication|care|provider|member|admissions|quality|safety)\b/.test(text)) return 'clinical';
    if (/\b(strategic|market|positioning|roadmap|growth|launch|board|bid cycle|competitive)\b/.test(text)) return 'strategic';
    if (/\b(how|process|steps|workflow|who|when|where|timeline|implement)\b/.test(text)) return 'operational';
    return 'general';
}

// Determine which agents should participate based on intent
export function routeToAgents(intent, message = '') {
    const agents = ['Employee']; // Always starts with Employee

    switch (intent) {
        case 'phi_sensitive':
            agents.push('ChiefMedicalOfficer');
            break;

        case 'escalation':
            agents.push('CFO', 'CMO', 'CEO');
            break;

        case 'exec_decision':
            agents.push('CFO', 'CMO', 'CEO');
            break;

        case 'financial':
            agents.push('CFO');
            // Add CEO if it's a large strategic financial decision
            if (/\b(strategic|decision|approve|invest|fund)\b/i.test(message)) {
                agents.push('CEO');
            }
            break;

        case 'clinical':
            agents.push('ChiefMedicalOfficer');
            // Add CMO if it involves member/provider relationships
            if (/\b(member|provider|trust|satisfaction|network)\b/i.test(message)) {
                agents.push('CMO');
            }
            break;

        case 'compliance':
            agents.push('ChiefMedicalOfficer');
            agents.push('CFO'); // Compliance often has financial implications
            break;

        case 'strategic':
            agents.push('CFO', 'CMO', 'CEO');
            break;

        case 'operational':
            // Employee handles most operational queries directly
            // But escalate if budget/clinical keywords present
            if (/\b(budget|cost|roi)\b/i.test(message)) agents.push('CFO');
            if (/\b(patient|clinical|safety)\b/i.test(message)) agents.push('ChiefMedicalOfficer');
            break;

        default:
            // General queries stay with Employee
            break;
    }

    return [...new Set(agents)]; // Deduplicate
}

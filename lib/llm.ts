import type { Lead, LeadStatus } from "@/lib/types";

export interface LeadAnalysis {
    opportunities: string[];
    painPoints: string[];
    timeSaved: number;
    services: string[];
    leadScore: LeadStatus;
    raw: string;
}

/**
 * Call our API route which proxies the Groq request server-side.
 * Throws on network errors or non-2xx responses.
 */
async function callGroq(
    apiKey: string,
    task: "analyze" | "email" | "linkedin",
    prompt: string
): Promise<string> {
    const res = await fetch("/api/groq", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task, prompt, apiKey }),
    });

    const rawText = await res.text();

    if (!res.ok) {
        let errMsg = `Request failed (${res.status})`;
        if (rawText) {
            try {
                const parsed = JSON.parse(rawText);
                errMsg = parsed.error || parsed.details || errMsg;
            } catch {
                errMsg = rawText.slice(0, 200);
            }
        }
        throw new Error(errMsg);
    }

    let data: { text?: string };
    try {
        data = JSON.parse(rawText);
    } catch {
        throw new Error("Malformed response from /api/groq");
    }

    if (!data.text) throw new Error("Empty response from Groq");
    return data.text;
}

/**
 * Analyze a lead using Groq. Returns structured analysis.
 */
export async function analyzeLead(
    lead: Lead,
    apiKey: string
): Promise<LeadAnalysis> {
    const prompt = `You are an expert AI automation consultant. Analyze this business and provide a structured JSON output:

Company: ${lead.company_name || "Unknown"}
Industry: ${lead.industry || "General"}
Website: ${lead.website || "N/A"}
Contact: ${lead.contact_name || "N/A"}

You must return EXACTLY a JSON object with the following keys. No markdown block enclosing it, just pure JSON:
{
  "opportunities": ["[Specific opportunity 1]", "[Specific opportunity 2]", "[Specific opportunity 3]"],
  "pain_points": ["[Specific pain point 1]", "[Specific pain point 2]"],
  "time_saved": 40,
  "services": ["[AI service 1]", "[AI service 2]", "[AI service 3]"],
  "lead_score": "Cold" // Must be one of "Cold", "Warm", "Hot"
}

You must respond with valid JSON only.`;

    const text = await callGroq(apiKey, "analyze", prompt);

    // Parse Groq JSON
    let parsed: any = {};
    try {
        parsed = JSON.parse(text);
    } catch (err) {
        console.error("Failed to parse Groq response as JSON:", text);
        // fallback empty if totally broken
    }

    // Ensure the types
    const opportunities = Array.isArray(parsed.opportunities) ? parsed.opportunities : [];
    const painPoints = Array.isArray(parsed.pain_points) ? parsed.pain_points : [];
    const timeSaved = typeof parsed.time_saved === "number" ? parsed.time_saved : 30;
    const services = Array.isArray(parsed.services) ? parsed.services : [];

    let leadScoreStr = String(parsed.lead_score || "Cold").trim();
    let leadScore: LeadStatus = "Cold";
    if (/hot/i.test(leadScoreStr)) leadScore = "Hot";
    else if (/warm/i.test(leadScoreStr)) leadScore = "Warm";

    return {
        opportunities: opportunities.slice(0, 3),
        painPoints: painPoints.slice(0, 3),
        timeSaved,
        services: services.slice(0, 3),
        leadScore,
        raw: text,
    };
}

/**
 * Generate a personalized cold email using Groq.
 */
export async function generateEmail(
    lead: Lead,
    analysis: string,
    apiKey: string
): Promise<string> {
    const prompt = `Write a personalized cold email for this lead:
Company: ${lead.company_name || "Unknown"}
Industry: ${lead.industry || "General"}
Contact: ${lead.contact_name || "there"}
AI Analysis: ${analysis}

Write a professional, concise cold email (max 150 words) that:
- Opens with a personalized hook about their industry
- Mentions 1 specific pain point
- Offers AI automation as solution
- Includes a soft CTA for a 15-min call
- Sign off professionally

Return EXACTLY a JSON object with this key: { "email_body": "Your email here" }
You must respond with valid JSON only.`;

    const text = await callGroq(apiKey, "email", prompt);
    let parsed: any = {};
    try {
        parsed = JSON.parse(text);
        return parsed.email_body || text;
    } catch (err) {
        return text;
    }
}

/**
 * Generate a LinkedIn connection message using Groq.
 */
export async function generateLinkedInMessage(
    lead: Lead,
    apiKey: string
): Promise<string> {
    const prompt = `Write a short LinkedIn connection request (max 50 words) for ${lead.contact_name || "there"} at ${lead.company_name || "their company"}. Mention their industry (${lead.industry || "general"}) and suggest connecting to discuss AI automation. 

Return EXACTLY a JSON object with this key: { "message": "Your message here" }
You must respond with valid JSON only.`;

    const text = await callGroq(apiKey, "linkedin", prompt);
    let parsed: any = {};
    try {
        parsed = JSON.parse(text);
        return parsed.message || text;
    } catch (err) {
        return text;
    }
}

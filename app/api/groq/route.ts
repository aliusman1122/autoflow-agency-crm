import { NextRequest, NextResponse } from "next/server";
import { decryptKey } from "@/lib/crypto";

// Force the Node.js runtime for full fetch support.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
const MODEL_NAME = "llama-3.3-70b-versatile";

// Rate limiting state
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

interface GroqRequestBody {
    task: "analyze" | "email" | "linkedin";
    prompt: string;
    apiKey?: string;
}

function jsonResponse(data: Record<string, unknown>, status: number): NextResponse {
    return new NextResponse(JSON.stringify(data), {
        status,
        headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-store",
        },
    });
}

export async function POST(req: NextRequest) {
    let body: GroqRequestBody;

    try {
        body = (await req.json()) as GroqRequestBody;
    } catch {
        return jsonResponse({ error: "Invalid JSON in request body" }, 400);
    }

    console.log("[/api/groq] task:", body.task);

    if (!body.task || !body.prompt) {
        return jsonResponse({ error: "Missing 'task' or 'prompt' in request body" }, 400);
    }

    // --- Rate Limiting ---
    const ip = req.headers.get("x-forwarded-for") || "127.0.0.1";
    const now = Date.now();
    const mapEntry = rateLimitMap.get(ip) || { count: 0, resetTime: now + 60000 };

    if (now > mapEntry.resetTime) {
        mapEntry.count = 1;
        mapEntry.resetTime = now + 60000;
    } else {
        mapEntry.count++;
    }

    rateLimitMap.set(ip, mapEntry);

    if (mapEntry.count > 20) {
        return jsonResponse({ error: "Too many requests. Please try again in a minute." }, 429);
    }

    // --- Resolve the API key ---
    let apiKey = body.apiKey;
    let usingFallback = false;

    if (apiKey && apiKey !== process.env.GROQ_API_KEY && apiKey !== process.env.NEXT_PUBLIC_GROQ_API_KEY && apiKey !== process.env.GEMINI_API_KEY && apiKey !== process.env.NEXT_PUBLIC_GEMINI_API_KEY) {
        try {
            const decrypted = decryptKey(apiKey);
            apiKey = decrypted;
        } catch (err) {
            console.warn("[/api/groq] Decryption failed, falling back to env vars", err);
            usingFallback = true;
            apiKey = undefined;
        }
    } else {
        usingFallback = true;
    }

    if (usingFallback || !apiKey) {
        apiKey = process.env.GROQ_API_KEY || process.env.NEXT_PUBLIC_GROQ_API_KEY || process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    }

    if (!apiKey) {
        console.error("[/api/groq] No API key available.");
        return jsonResponse(
            { error: "No Groq API key configured. Add one in Settings → Integrations." },
            401
        );
    }

    // --- Call the Groq API server-side ---
    let groqRes: Response;
    try {
        groqRes = await fetch(GROQ_ENDPOINT, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: MODEL_NAME,
                messages: [{ role: "user", content: body.prompt }],
                response_format: { type: "json_object" },
                temperature: 0.7,
                max_completion_tokens: 1024,
            }),
        });
    } catch (fetchErr) {
        const msg = fetchErr instanceof Error ? fetchErr.message : "fetch failed";
        console.error("[/api/groq] fetch error:", msg);
        return jsonResponse({ error: `Failed to reach Groq API: ${msg}` }, 502);
    }

    const rawText = await groqRes.text();

    if (!groqRes.ok) {
        console.error(`[/api/groq] API returned ${groqRes.status}:`, rawText.slice(0, 500));
        let errDetail = rawText;
        try {
            const parsed = JSON.parse(rawText);
            errDetail = parsed?.error?.message || parsed?.error || rawText;
        } catch {
            // not JSON
        }
        return jsonResponse(
            {
                error: `Groq API error (${groqRes.status})`,
                details: typeof errDetail === "string" ? errDetail : JSON.stringify(errDetail),
            },
            groqRes.status
        );
    }

    // --- Parse the Groq response and extract text ---
    let data: any;
    try {
        data = JSON.parse(rawText);
    } catch {
        return jsonResponse({ error: "Malformed response from Groq API" }, 502);
    }

    const content = data?.choices?.[0]?.message?.content;
    if (content) {
        return jsonResponse({ text: content }, 200);
    }

    return jsonResponse({ error: "Empty or unexpected response from Groq" }, 502);
}

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const N8N_SECRET = process.env.N8N_WEBHOOK_SECRET;

export async function POST(req: NextRequest) {
    const secret = req.headers.get("x-n8n-secret");
    if (secret !== N8N_SECRET) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { error } = await supabase.from("notifications").insert({
        user_id: body.user_id,
        title: `Proposal accepted: ${body.title}`,
        message: `${body.client_name} accepted the proposal.`,
        type: "proposal",
        entity_id: body.proposal_id || body.entity_id,
    });

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}

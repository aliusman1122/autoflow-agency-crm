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
        title: `Invoice paid: ${body.invoice_number}`,
        message: `Invoice #${body.invoice_number} for ${body.amount} has been paid.`,
        type: "invoice",
        entity_id: body.invoice_id || body.entity_id,
    });

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}

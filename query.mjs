import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env" });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function run() {
    const { data, error } = await supabase
        .from("invoices")
        .select("invoice_number, lead_id, created_at")
        .order("invoice_number", { ascending: false })
        .limit(20);

    console.log("DATA:", data);
    if (error) {
        console.error("ERROR:", error);
    }
}
run();

import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const supabaseUrl = "https://loqigszcsyrcrepmpqgn.supabase.co";
const supabaseKey = "sb_publishable_vEyR2FxkDGBqkAvGJPI1Vg_9iNmRj3Y";

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const { data, error } = await supabase
        .from("invoices")
        .select("invoice_number, lead_id, created_at")
        .order("invoice_number", { ascending: false })
        .limit(20);

    fs.writeFileSync("output.txt", JSON.stringify(data, null, 2));
    if (error) {
        fs.writeFileSync("output_err.txt", JSON.stringify(error, null, 2));
    }
}
run();

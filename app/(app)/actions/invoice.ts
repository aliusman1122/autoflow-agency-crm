"use server";
import { createClient } from "@supabase/supabase-js";

export async function createInvoiceAction(
    accessToken: string,
    invoiceData: {
        lead_id: string;
        proposal_id: string;
        amount: number;
        status: string;
        due_date: string;
        currency: string;
    },
    invoiceItems: { description: string; amount: number }[]
) {
    console.log("ENV CHECK:", process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(0, 20));

    // SECURITY FIX: Before bypassing RLS, we MUST manually verify authorization.
    // We create a temporary client with the user's JWT strictly to prove ownership.
    const userClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            global: {
                headers: { Authorization: `Bearer ${accessToken}` },
                fetch: (url, options) => fetch(url, { ...(options || {}), cache: "no-store", next: { revalidate: 0 } })
            }
        }
    );

    // RLS will automatically enforce that the user can only see leads they own
    const { data: authVerification, error: authError } = await userClient
        .from("leads")
        .select("id")
        .eq("id", invoiceData.lead_id)
        .limit(1);

    if (authError || !authVerification || authVerification.length === 0) {
        throw new Error("Unauthorized: You do not have permission to generate invoices for this lead.");
    }

    // BUG FIX 1: Verification passed. We now use the Service Role Key to bypass RLS.
    // This allows the server action to definitively see ALL invoices in the database
    // for exact gap calculations, preventing collision due to hidden records.
    const serviceClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
                detectSessionInUrl: false
            },
            global: {
                fetch: (url, options) => fetch(url, { ...(options || {}), cache: "no-store", next: { revalidate: 0 } })
            }
        }
    );

    console.log("GUARD 1 check. proposal_id being requested:", invoiceData.proposal_id);

    if (!invoiceData.proposal_id) {
        throw new Error("proposal_id is required to create or fetch an invoice.");
    }

    // GUARD 1: Check if invoice already exists for this exact proposal
    const { data: existingByProposal, error: existingError } = await serviceClient
        .from("invoices")
        .select("id, invoice_number, lead_id, proposal_id")
        .eq("proposal_id", invoiceData.proposal_id)
        .limit(1);

    if (existingError) {
        console.error("Error querying existing proposal by ID:", existingError);
        // Do not silently continue if DB is missing column or throwing error
        throw existingError;
    }

    if (existingByProposal && existingByProposal.length > 0) {
        const existing = existingByProposal[0];
        console.log("GUARD 1 hit. Returning existing invoice:", existing.invoice_number);
        // Optionally update status here in the future
        return existing;
    }

    // BUG FIX 2: Guard 2 (Hijacking Unrelated Old Invoices) has been completely removed!

    // Fetch ALL invoice numbers for gap-filling logic
    const { data: allInvoices, error: fetchError } = await serviceClient
        .from("invoices")
        .select("invoice_number");

    if (fetchError) throw fetchError;

    console.log("ALL INVOICES COUNT:", allInvoices?.length || 0);
    console.log("ALL INVOICE NUMBERS:", allInvoices?.map(i => i.invoice_number));

    // Extract numeric parts into a sorted array (deduplicated)
    const numbers = Array.from(new Set(
        (allInvoices || []).map(inv => {
            const match = inv.invoice_number?.match(/(\d+)$/);
            return match ? parseInt(match[1], 10) : 0;
        })
    )).filter(n => n > 0).sort((a, b) => a - b);

    // Find the first gap
    // Test cases:
    // [] → next = 1
    // [1, 2, 3, 4] → next = 5
    // [1, 2, 3, 4, 12, 13] → next = 5 (gap fill!)
    // [1, 2, 3, 4, 5, 6] → next = 7
    let baseNextNum = 1;
    for (let i = 0; i < numbers.length; i++) {
        if (numbers[i] !== baseNextNum) {
            break; // Found gap at baseNextNum
        }
        baseNextNum++;
    }

    let collisionOffset = 0;
    let invError: any = null;
    let invData: any = null;
    let retries = 10; // BUG FIX 3: Increased from 3 to 10 for enterprise safety

    while (retries > 0) {
        const nextNum = baseNextNum + collisionOffset;
        const invoiceNumber = `INV-${String(nextNum).padStart(3, "0")}`;

        console.log(`Attempting to insert new invoice mapping: ${invoiceNumber} (retries remaining: ${retries})`);

        const { data, error } = await serviceClient
            .from("invoices")
            .insert({
                ...invoiceData,
                invoice_number: invoiceNumber,
            })
            .select();

        if (error) {
            if (error.code === '23505') {
                console.warn(`Encountered 23505 duplicate collision for ${invoiceNumber}.`);

                // Could be invoice_number OR proposal_id collision
                // If proposal_id collision, it means invoice already exists
                // Re-query to find and return existing invoice
                const { data: existing } = await serviceClient
                    .from("invoices")
                    .select("id, invoice_number, lead_id, proposal_id")
                    .eq("proposal_id", invoiceData.proposal_id)
                    .limit(1);

                if (existing && existing.length > 0) {
                    console.log("Race condition caught upon insert. Returning existing:", existing[0].invoice_number);
                    return existing[0];
                }

                // Otherwise it's invoice_number collision, retry with next number
                collisionOffset += 1;
                retries -= 1;
                if (retries === 0) break;
                continue;
            }
            throw error; // Any other error, throw immediately
        }

        // Handle 0 rows returned (shouldn't happen, but defensive)
        if (!data || data.length === 0) {
            throw new Error("Invoice insert returned no data");
        }

        invData = data[0];
        invError = null;
        break;
    }

    if (!invData) {
        throw new Error(invError?.message || "Failed to create invoice with unique number");
    }

    // Create invoice items
    if (invoiceItems && invoiceItems.length > 0) {
        const { error: itemError } = await serviceClient
            .from("invoice_items")
            .insert(
                invoiceItems.map((item) => ({
                    ...item,
                    invoice_id: invData.id,
                }))
            );
        if (itemError) {
            await serviceClient.from("invoices").delete().eq("id", invData.id);
            throw itemError;
        }
    }

    return invData;
}

export async function autoCreateInvoiceAction(accessToken: string, proposal: any) {
    if (!proposal || !proposal.id || !proposal.lead_id || !proposal.pricing) {
        throw new Error("Invalid proposal data: missing id, lead_id, or pricing");
    }

    const next30Days = new Date();
    next30Days.setDate(next30Days.getDate() + 30);

    const invoiceData = {
        lead_id: proposal.lead_id,
        proposal_id: proposal.id,  // <-- FIXED: Pass proposal.id
        amount: proposal.pricing,
        status: "Unpaid",
        due_date: next30Days.toISOString().split("T")[0],
        currency: proposal.currency,
    };

    const invoiceItems = [
        {
            description: proposal.title || "Proposal Services",
            amount: proposal.pricing,
        },
    ];

    try {
        return await createInvoiceAction(accessToken, invoiceData, invoiceItems);
    } catch (e: any) {
        console.error("Server Action autoCreateInvoiceAction failed:", e);
        throw new Error(e.message || "Failed to auto-create invoice");
    }
}

"use server";

import { sendEmail } from "@/lib/email";
import { sendProposalEmail, sendInvoiceEmail } from "@/lib/email-templates";
import { decryptKey } from "@/lib/crypto";

function getApiKey(encryptedKey?: string | null) {
    if (encryptedKey) {
        try {
            return decryptKey(encryptedKey);
        } catch {
            // failed to decrypt
        }
    }
    return undefined;
}

export async function sendProposalEmailAction(
    encryptedResendKey: string | null | undefined,
    leadEmail: string,
    proposal: any
) {
    if (!leadEmail) {
        throw new Error("Lead doesn't have an email address.");
    }

    const apiKey = getApiKey(encryptedResendKey);
    const html = sendProposalEmail(leadEmail, proposal);

    return await sendEmail({
        apiKey,
        to: leadEmail,
        subject: `Proposal: ${proposal.title || "New Proposal"}`,
        html,
    });
}

export async function sendInvoiceEmailAction(
    encryptedResendKey: string | null | undefined,
    leadEmail: string,
    invoice: any
) {
    if (!leadEmail) {
        throw new Error("Lead doesn't have an email address.");
    }

    const apiKey = getApiKey(encryptedResendKey);
    const html = sendInvoiceEmail(leadEmail, invoice);

    return await sendEmail({
        apiKey,
        to: leadEmail,
        subject: `Invoice: ${invoice.invoice_number || 'New Invoice'}`,
        html,
    });
}

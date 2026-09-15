import { Resend } from "resend";

let resendInstance: Resend | null = null;

export function getResendClient(apiKey?: string): Resend {
    if (apiKey) {
        return new Resend(apiKey);
    }

    if (resendInstance) {
        return resendInstance;
    }

    const envKey = process.env.RESEND_API_KEY;
    if (envKey) {
        resendInstance = new Resend(envKey);
        return resendInstance;
    }

    throw new Error("RESEND_API_KEY is not configured in environment variables");
}

export async function sendEmail({
    apiKey,
    to,
    subject,
    html,
}: {
    apiKey?: string;
    to: string | string[];
    subject: string;
    html: string;
}) {
    const resend = getResendClient(apiKey);

    // Debug hooks
    console.log("Resend API Key Prefix:", (apiKey || process.env.RESEND_API_KEY || "").slice(0, 10));

    // TODO: Replace with verified domain email before production launch
    const from = process.env.FROM_EMAIL || "onboarding@resend.dev";
    console.log("From:", from);

    const toArray = Array.isArray(to) ? to : [to];

    if (from.includes("onboarding@resend.dev")) {
        const hasExternalDestinations = toArray.some(email => !email.includes("usmann.ngbc@gmail.com"));
        if (hasExternalDestinations) {
            console.warn("Cannot send to external email with onboarding@resend.dev. Domain verification required.");
            throw new Error("Domain not verified. Please verify your domain in Resend to send to external client emails.");
        }
    }

    try {
        const response = await resend.emails.send({
            from,
            to,
            subject,
            html,
        });
        console.log("Resend full response:", JSON.stringify(response, null, 2));

        if (response.error) {
            console.error("[Resend Error]:", response.error);
            throw new Error(response.error.message || "Failed to send email via Resend");
        }

        return response.data;
    } catch (e: any) {
        console.error("Resend EXCEPTION:", e);
        throw e;
    }
}

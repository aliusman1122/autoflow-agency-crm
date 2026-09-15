// AutoFlow Agency - shared TypeScript types for Supabase entities

export type LeadStatus = "Cold" | "Warm" | "Hot";

export type PipelineStage =
    | "New Lead"
    | "Contacted"
    | "Follow Up"
    | "Interested"
    | "Meeting Scheduled"
    | "Proposal Sent"
    | "Negotiation"
    | "Won"
    | "Lost";

export type ProposalStatus = "Draft" | "Sent" | "Accepted" | "Rejected";
export type InvoiceStatus = "Paid" | "Unpaid" | "Void";
export type Currency = "USD" | "EUR" | "GBP" | "PKR";

export const PIPELINE_STAGES: PipelineStage[] = [
    "New Lead",
    "Contacted",
    "Follow Up",
    "Interested",
    "Meeting Scheduled",
    "Proposal Sent",
    "Negotiation",
    "Won",
    "Lost",
];

export const LEAD_STATUSES: LeadStatus[] = ["Cold", "Warm", "Hot"];

export const INDUSTRIES = [
    "Real Estate",
    "E-commerce",
    "Healthcare",
    "Legal",
    "SaaS",
    "Marketing",
    "Finance",
    "Hospitality",
    "Manufacturing",
    "Education",
    "Logistics",
    "Other",
];

export const CURRENCIES: Currency[] = ["USD", "EUR", "GBP", "PKR"];

export const CURRENCY_SYMBOLS: Record<Currency, string> = {
    USD: "$",
    EUR: "€",
    GBP: "£",
    PKR: "Rs",
};

export interface BrandColors {
    primary: string;
    secondary: string;
}

export interface Profile {
    id: string;
    email: string | null;
    agency_name: string | null;
    brand_colors: BrandColors | null;
    currency: Currency | null;
    gemini_key: string | null;
    resend_key?: string | null;
    created_at: string;
    updated_at: string;
}

export interface Lead {
    id: string;
    user_id: string;
    company_name: string | null;
    contact_name: string | null;
    email: string | null;
    phone: string | null;
    website: string | null;
    industry: string | null;
    status: LeadStatus | null;
    pipeline_stage: PipelineStage | null;
    notes: string | null;
    is_archived: boolean | null;
    created_at: string;
    updated_at: string;
}

export interface Proposal {
    id: string;
    lead_id: string;
    title: string | null;
    scope: string | null;
    deliverables: string | null;
    pricing: number | null;
    currency?: string | null;
    timeline: string | null;
    status: ProposalStatus | null;
    created_at: string;
    updated_at: string;
}

export interface InvoiceItem {
    id: string;
    invoice_id: string;
    description: string;
    amount: number;
    created_at: string;
}

export interface Invoice {
    id: string;
    lead_id: string;
    invoice_number: string | null;
    amount: number | null;
    currency?: string | null;
    status: InvoiceStatus | null;
    due_date: string | null;
    created_at: string;
    updated_at: string;
    items?: InvoiceItem[];
}

export interface LeadWithRelations extends Lead {
    proposals?: Proposal[];
    invoices?: Invoice[];
}

export interface Notification {
    id: string;
    user_id: string;
    title: string;
    message?: string | null;
    type: "lead" | "proposal" | "invoice" | "system";
    entity_id?: string | null;
    read: boolean;
    created_at: string;
}

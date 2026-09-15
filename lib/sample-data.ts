import type { Lead, LeadStatus, PipelineStage } from "@/lib/types";

interface SampleLeadInput {
  company_name: string;
  contact_name: string;
  email: string;
  phone: string;
  website: string;
  industry: string;
  status: LeadStatus;
  pipeline_stage: PipelineStage;
  notes: string;
}

export const SAMPLE_LEADS: SampleLeadInput[] = [
  {
    company_name: "Summit Property Group",
    contact_name: "Rachel Chen",
    email: "rachel@summitprop.com",
    phone: "+1 (415) 555-0142",
    website: "summitprop.com",
    industry: "Real Estate",
    status: "Hot",
    pipeline_stage: "Proposal Sent",
    notes:
      "Looking to automate lead qualification and property matching. 200+ agents.",
  },
  {
    company_name: "BloomCommerce",
    contact_name: "Marcus Johnson",
    email: "marcus@bloomcommerce.io",
    phone: "+1 (212) 555-0198",
    website: "bloomcommerce.io",
    industry: "E-commerce",
    status: "Warm",
    pipeline_stage: "Meeting Scheduled",
    notes:
      "DTC brand with 50K SKUs. Wants AI-powered product recommendations and chatbot support.",
  },
  {
    company_name: "Meridian Health Partners",
    contact_name: "Dr. Aisha Patel",
    email: "apatel@meridianhealth.org",
    phone: "+1 (617) 555-0173",
    website: "meridianhealth.org",
    industry: "Healthcare",
    status: "Hot",
    pipeline_stage: "Negotiation",
    notes:
      "Multi-clinic network. Needs appointment scheduling automation and patient intake AI.",
  },
  {
    company_name: "Westfield Legal Associates",
    contact_name: "James O'Connor",
    email: "james@westfieldlegal.com",
    phone: "+1 (312) 555-0167",
    website: "westfieldlegal.com",
    industry: "Legal",
    status: "Warm",
    pipeline_stage: "Contacted",
    notes:
      "Mid-size law firm. Interested in contract review automation and document analysis.",
  },
  {
    company_name: "Nexus Software Labs",
    contact_name: "Priya Sharma",
    email: "priya@nexuslabs.dev",
    phone: "+1 (408) 555-0123",
    website: "nexuslabs.dev",
    industry: "SaaS",
    status: "Hot",
    pipeline_stage: "Interested",
    notes:
      "B2B SaaS startup. Looking for AI-driven customer onboarding and churn prediction.",
  },
  {
    company_name: "Pulse Marketing Co.",
    contact_name: "Elena Rodriguez",
    email: "elena@pulsemarketing.co",
    phone: "+1 (786) 555-0189",
    website: "pulsemarketing.co",
    industry: "Marketing",
    status: "Cold",
    pipeline_stage: "New Lead",
    notes:
      "Agency seeking AI content generation and campaign analytics automation.",
  },
  {
    company_name: "Vertex Capital",
    contact_name: "David Kim",
    email: "dkim@vertexcap.finance",
    phone: "+1 (646) 555-0156",
    website: "vertexcap.finance",
    industry: "Finance",
    status: "Warm",
    pipeline_stage: "Follow Up",
    notes:
      "Investment firm. Wants automated portfolio reporting and risk assessment AI.",
  },
  {
    company_name: "Grand Horizon Hotels",
    contact_name: "Sophie Laurent",
    email: "sophie@grandhorizon.com",
    phone: "+1 (305) 555-0111",
    website: "grandhorizon.com",
    industry: "Hospitality",
    status: "Cold",
    pipeline_stage: "New Lead",
    notes:
      "Hotel chain. Interested in AI concierge and dynamic pricing automation.",
  },
];

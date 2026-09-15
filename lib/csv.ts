import type { LeadStatus, PipelineStage } from "@/lib/types";
import { LEAD_STATUSES, PIPELINE_STAGES } from "@/lib/types";

export interface ParsedLeadRow {
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

// Parse a simple CSV string into rows. Handles quoted fields with commas
// and embedded quotes. Returns an array of string arrays (one per row).
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

const HEADER_MAP: Record<string, keyof ParsedLeadRow> = {
  company: "company_name",
  company_name: "company_name",
  "company name": "company_name",
  contact: "contact_name",
  contact_name: "contact_name",
  "contact name": "contact_name",
  name: "contact_name",
  email: "email",
  phone: "phone",
  website: "website",
  industry: "industry",
  status: "status",
  pipeline_stage: "pipeline_stage",
  "pipeline stage": "pipeline_stage",
  notes: "notes",
};

export function parseCSV(csvText: string): ParsedLeadRow[] {
  const lines = csvText
    .trim()
    .split(/\r?\n/)
    .filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];

  const headers = parseCSVLine(lines[0]).map((h) =>
    h.toLowerCase().trim().replace(/"/g, "")
  );

  const rows: ParsedLeadRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const obj: Partial<ParsedLeadRow> = {};
    headers.forEach((header, idx) => {
      const field = HEADER_MAP[header];
      if (field) {
        const value = values[idx] ?? "";
        if (field === "status") {
          const cap = value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
          obj.status = LEAD_STATUSES.includes(cap as LeadStatus)
            ? (cap as LeadStatus)
            : "Cold";
        } else if (field === "pipeline_stage") {
          const found = PIPELINE_STAGES.find(
            (s) => s.toLowerCase() === value.toLowerCase()
          );
          obj.pipeline_stage = found ?? "New Lead";
        } else {
          (obj as Record<string, string>)[field] = value;
        }
      }
    });

    // Only add rows with at least a company name or contact name.
    if (obj.company_name || obj.contact_name) {
      rows.push({
        company_name: obj.company_name || "",
        contact_name: obj.contact_name || "",
        email: obj.email || "",
        phone: obj.phone || "",
        website: obj.website || "",
        industry: obj.industry || "Other",
        status: obj.status ?? "Cold",
        pipeline_stage: obj.pipeline_stage ?? "New Lead",
        notes: obj.notes || "",
      });
    }
  }
  return rows;
}

import jsPDF from "jspdf";

interface ProposalPdfData {
  agencyName: string;
  leadCompanyName: string;
  leadContactName: string;
  leadEmail: string;
  title: string;
  scope: string;
  deliverables: string;
  timeline: string;
  pricing: number;
  currency: string;
  primaryColor: string;
}

export function generateProposalPdf(data: ProposalPdfData): jsPDF {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 40;
  const contentWidth = pageWidth - margin * 2;
  const primaryColor = hexToRgb(data.primaryColor || "#4f46e5");

  // Header band
  doc.setFillColor(primaryColor.r, primaryColor.g, primaryColor.b);
  doc.rect(0, 0, pageWidth, 30, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(data.agencyName || "AutoFlow Agency", margin, 19);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("PROPOSAL", pageWidth - margin, 19, { align: "right" });

  let y = 50;

  // Proposal title
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  const titleLines = doc.splitTextToSize(data.title || "Project Proposal", contentWidth);
  doc.text(titleLines, margin, y);
  y += titleLines.length * 10 + 8;

  // Date
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  doc.text(
    `Date: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`,
    margin,
    y
  );
  y += 16;

  // Client info section
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 10;

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 41, 59);
  doc.text("Prepared For", margin, y);
  y += 7;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  doc.text(data.leadCompanyName || "—", margin, y);
  y += 6;
  if (data.leadContactName) {
    doc.text(data.leadContactName, margin, y);
    y += 6;
  }
  if (data.leadEmail) {
    doc.text(data.leadEmail, margin, y);
    y += 6;
  }
  y += 10;

  // Scope
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(30, 41, 59);
  doc.text("Project Scope", margin, y);
  y += 7;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  doc.setFontSize(10);
  const scopeLines = doc.splitTextToSize(data.scope || "—", contentWidth);
  doc.text(scopeLines, margin, y);
  y += scopeLines.length * 5 + 10;

  // Deliverables
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(30, 41, 59);
  doc.text("Deliverables", margin, y);
  y += 7;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  doc.setFontSize(10);
  const deliverableLines = doc.splitTextToSize(
    data.deliverables || "—",
    contentWidth
  );
  doc.text(deliverableLines, margin, y);
  y += deliverableLines.length * 5 + 10;

  // Timeline
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(30, 41, 59);
  doc.text("Timeline", margin, y);
  y += 7;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  doc.setFontSize(10);
  doc.text(data.timeline || "—", margin, y);
  y += 14;

  // Pricing table
  doc.setFillColor(248, 250, 252);
  doc.rect(margin, y - 4, contentWidth, 22, "F");
  doc.setDrawColor(226, 232, 240);
  doc.rect(margin, y - 4, contentWidth, 22);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  doc.text("Description", margin + 8, y + 6);
  doc.text("Total", pageWidth - margin - 8, y + 6, { align: "right" });
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, y + 10, pageWidth - margin, y + 10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  doc.text(data.title || "AI Automation Services", margin + 8, y + 16);
  const symbol = getCurrencySymbol(data.currency);
  doc.text(`${symbol}${data.pricing.toLocaleString()}`, pageWidth - margin - 8, y + 16, {
    align: "right",
  });
  y += 28;

  // Total
  doc.setFillColor(primaryColor.r, primaryColor.g, primaryColor.b);
  doc.rect(margin, y, contentWidth, 14, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("TOTAL", margin + 8, y + 9);
  doc.text(
    `${symbol}${data.pricing.toLocaleString()}`,
    pageWidth - margin - 8,
    y + 9,
    { align: "right" }
  );
  y += 26;

  // Footer
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, pageHeight - 30, pageWidth - margin, pageHeight - 30);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(148, 163, 184);
  doc.text(
    `${data.agencyName} — AI Automation Agency`,
    margin,
    pageHeight - 22
  );
  doc.text(
    "This proposal is valid for 30 days from the date of issue.",
    margin,
    pageHeight - 15
  );
  doc.text("Thank you for considering us!", pageWidth - margin, pageHeight - 15, {
    align: "right",
  });

  return doc;
}

interface InvoicePdfData {
  agencyName: string;
  invoiceNumber: string;
  leadCompanyName: string;
  leadContactName: string;
  leadEmail: string;
  items: { description: string; amount: number }[];
  total: number;
  status: string;
  dueDate: string | null;
  currency: string;
  primaryColor: string;
}

export function generateInvoicePdf(data: InvoicePdfData): jsPDF {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 40;
  const contentWidth = pageWidth - margin * 2;
  const primaryColor = hexToRgb(data.primaryColor || "#4f46e5");

  // Header band
  doc.setFillColor(primaryColor.r, primaryColor.g, primaryColor.b);
  doc.rect(0, 0, pageWidth, 30, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(data.agencyName || "AutoFlow Agency", margin, 19);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("INVOICE", pageWidth - margin, 19, { align: "right" });

  let y = 50;

  // Invoice number + status
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(data.invoiceNumber || "INV-001", margin, y);
  const statusColor = data.status === "Paid" ? { r: 16, g: 185, b: 129 } : { r: 249, g: 115, b: 22 };
  doc.setFillColor(statusColor.r, statusColor.g, statusColor.b);
  const statusText = data.status || "Unpaid";
  const statusWidth = doc.getTextWidth(statusText) + 12;
  doc.roundedRect(pageWidth - margin - statusWidth, y - 7, statusWidth, 10, 2, 2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text(statusText, pageWidth - margin - statusWidth / 2, y, {
    align: "center",
  });

  y += 16;

  // Bill to + dates
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 41, 59);
  doc.text("Bill To:", margin, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  doc.text(data.leadCompanyName || "—", margin, y);
  y += 6;
  if (data.leadContactName) {
    doc.text(data.leadContactName, margin, y);
    y += 6;
  }
  if (data.leadEmail) {
    doc.text(data.leadEmail, margin, y);
    y += 6;
  }

  // Due date on right
  let rightY = y - (data.leadEmail ? 18 : data.leadContactName ? 12 : 6);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 41, 59);
  doc.text("Issue Date:", pageWidth - margin - 80, rightY);
  doc.text("Due Date:", pageWidth - margin - 80, rightY + 12);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  doc.text(
    new Date().toLocaleDateString("en-US"),
    pageWidth - margin,
    rightY,
    { align: "right" }
  );
  doc.text(
    data.dueDate
      ? new Date(data.dueDate).toLocaleDateString("en-US")
      : "—",
    pageWidth - margin,
    rightY + 12,
    { align: "right" }
  );

  y += 14;

  // Items table header
  doc.setFillColor(primaryColor.r, primaryColor.g, primaryColor.b);
  doc.rect(margin, y, contentWidth, 12, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Description", margin + 8, y + 8);
  doc.text("Amount", pageWidth - margin - 8, y + 8, { align: "right" });
  y += 12;

  // Items
  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  const symbol = getCurrencySymbol(data.currency);
  data.items.forEach((item, idx) => {
    if (idx % 2 === 0) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, y, contentWidth, 12, "F");
    }
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, y, pageWidth - margin, y);
    const descLines = doc.splitTextToSize(item.description, contentWidth - 60);
    doc.text(descLines[0] || "", margin + 8, y + 8);
    doc.text(
      `${symbol}${item.amount.toLocaleString()}`,
      pageWidth - margin - 8,
      y + 8,
      { align: "right" }
    );
    y += 12;
    if (y > doc.internal.pageSize.getHeight() - 60) {
      doc.addPage();
      y = 40;
    }
  });
  doc.line(margin, y, pageWidth - margin, y);
  y += 10;

  // Total
  doc.setFillColor(primaryColor.r, primaryColor.g, primaryColor.b);
  doc.rect(margin, y, contentWidth, 16, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("TOTAL DUE", margin + 8, y + 11);
  doc.text(
    `${symbol}${data.total.toLocaleString()}`,
    pageWidth - margin - 8,
    y + 11,
    { align: "right" }
  );
  y += 26;

  // Footer
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, pageHeight - 30, pageWidth - margin, pageHeight - 30);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(148, 163, 184);
  doc.text(
    `${data.agencyName} — AI Automation Agency`,
    margin,
    pageHeight - 22
  );
  doc.text(
    data.status === "Paid"
      ? "This invoice has been paid in full. Thank you!"
      : "Please remit payment by the due date. Thank you for your business!",
    margin,
    pageHeight - 15
  );

  return doc;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const cleaned = hex.replace("#", "");
  const r = parseInt(cleaned.substring(0, 2), 16) || 79;
  const g = parseInt(cleaned.substring(2, 4), 16) || 70;
  const b = parseInt(cleaned.substring(4, 6), 16) || 229;
  return { r, g, b };
}

function getCurrencySymbol(currency: string): string {
  const symbols: Record<string, string> = {
    USD: "$",
    EUR: "€",
    GBP: "£",
    PKR: "Rs",
  };
  return symbols[currency] ?? "$";
}

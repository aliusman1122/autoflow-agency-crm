"use client";

import * as React from "react";
import { toast } from "sonner";
import { Upload, FileSpreadsheet, Loader2, Download } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { parseCSV, type ParsedLeadRow } from "@/lib/csv";

interface ImportCsvDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
}

const CSV_TEMPLATE = `company_name,contact_name,email,phone,website,industry,status,pipeline_stage,notes
Acme Corp,John Smith,john@acme.com,+1 555-0100,acme.com,SaaS,Hot,Interested,Interested in AI chatbot
Globex,Jane Doe,jane@globex.com,+1 555-0200,globex.com,E-commerce,Warm,Contacted,Needs pricing info`;

export function ImportCsvDialog({
  open,
  onOpenChange,
  onImported,
}: ImportCsvDialogProps) {
  const [file, setFile] = React.useState<File | null>(null);
  const [parsedRows, setParsedRows] = React.useState<ParsedLeadRow[]>([]);
  const [importing, setImporting] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!open) {
      setFile(null);
      setParsedRows([]);
    }
  }, [open]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    if (!selected.name.endsWith(".csv") && selected.type !== "text/csv") {
      toast.error("Please select a CSV file");
      return;
    }
    setFile(selected);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = (ev.target?.result as string) ?? "";
      try {
        const rows = parseCSV(text);
        setParsedRows(rows);
        if (rows.length === 0) {
          toast.error("No valid rows found in the CSV");
        } else {
          toast.success(`Parsed ${rows.length} leads from CSV`);
        }
      } catch {
        toast.error("Failed to parse CSV file");
      }
    };
    reader.readAsText(selected);
  };

  const handleImport = async () => {
    if (parsedRows.length === 0) {
      toast.error("No rows to import");
      return;
    }
    setImporting(true);
    try {
      const { data, error } = await supabase
        .from("leads")
        .insert(parsedRows)
        .select("*");
      if (error) throw error;
      toast.success(`Imported ${data?.length ?? 0} leads successfully`);
      onImported();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to import leads");
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "leads_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Import Leads from CSV</DialogTitle>
          <DialogDescription>
            Upload a CSV file with your leads. The first row should contain
            column headers.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Template download */}
          <button
            onClick={downloadTemplate}
            className="flex items-center gap-2 text-xs font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
          >
            <Download className="h-3.5 w-3.5" />
            Download CSV template
          </button>

          {/* File picker */}
          <div
            onClick={() => inputRef.current?.click()}
            className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border p-8 text-center transition-colors hover:border-indigo-400 hover:bg-indigo-50/50 dark:hover:bg-indigo-500/5"
          >
            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={handleFileChange}
            />
            {file ? (
              <>
                <FileSpreadsheet className="mb-2 h-8 w-8 text-indigo-600" />
                <p className="text-sm font-medium text-foreground">{file.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {parsedRows.length} leads ready to import
                </p>
              </>
            ) : (
              <>
                <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
                <p className="text-sm font-medium text-foreground">
                  Click to select a CSV file
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Supports: company_name, contact_name, email, phone, website,
                  industry, status, pipeline_stage, notes
                </p>
              </>
            )}
          </div>

          {/* Preview */}
          {parsedRows.length > 0 && (
            <div className="max-h-40 overflow-y-auto rounded-lg border border-border scrollbar-thin">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Company</th>
                    <th className="px-3 py-2 text-left font-medium">Contact</th>
                    <th className="px-3 py-2 text-left font-medium">Industry</th>
                    <th className="px-3 py-2 text-left font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedRows.slice(0, 10).map((row, i) => (
                    <tr key={i} className="border-t border-border">
                      <td className="px-3 py-1.5">{row.company_name}</td>
                      <td className="px-3 py-1.5">{row.contact_name}</td>
                      <td className="px-3 py-1.5">{row.industry}</td>
                      <td className="px-3 py-1.5">{row.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {parsedRows.length > 10 && (
                <p className="bg-muted px-3 py-1.5 text-xs text-muted-foreground">
                  + {parsedRows.length - 10} more…
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={importing || parsedRows.length === 0}
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            {importing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Importing…
              </>
            ) : (
              `Import ${parsedRows.length} Lead${parsedRows.length !== 1 ? "s" : ""}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import * as React from "react";
import { toast } from "sonner";
import { Plus, Receipt, Download, Loader2, X, Trash2, Pencil } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Currency } from "@/lib/types";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InvoiceStatusBadge } from "@/components/status-badges";
import { generateInvoicePdf } from "@/lib/pdf";
import { formatCurrency, formatDate } from "@/lib/format";
import type { Lead, Invoice, InvoiceStatus } from "@/lib/types";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { sendInvoiceEmailAction } from "../actions/email";
import { createInvoiceAction } from "../actions/invoice";
import { Send } from "lucide-react";

interface InvoiceItem {
    description: string;
    amount: number;
}

export default function InvoicesPage() {
    const { profile, session } = useAuth();
    const [invoices, setInvoices] = React.useState<Invoice[]>([]);
    const [leads, setLeads] = React.useState<Lead[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [dialogOpen, setDialogOpen] = React.useState(false);
    const [submitting, setSubmitting] = React.useState(false);
    const [downloadingId, setDownloadingId] = React.useState<string | null>(null);
    const [sendingEmailId, setSendingEmailId] = React.useState<string | null>(null);

    const [deleteData, setDeleteData] = React.useState<Invoice | null>(null);
    const [deleteType, setDeleteType] = React.useState<"delete" | "void">("delete");

    // Edit state
    const [editingInvoice, setEditingInvoice] = React.useState<Invoice | null>(null);
    const [editDialogOpen, setEditDialogOpen] = React.useState(false);
    const [editDueDate, setEditDueDate] = React.useState("");
    const [editItems, setEditItems] = React.useState<InvoiceItem[]>([{ description: "", amount: 0 }]);
    const [editSubmitting, setEditSubmitting] = React.useState(false);

    // Form state
    const [selectedLeadId, setSelectedLeadId] = React.useState("");
    const [dueDate, setDueDate] = React.useState("");
    const [items, setItems] = React.useState<InvoiceItem[]>([
        { description: "", amount: 0 },
    ]);

    const loadData = React.useCallback(async () => {
        setLoading(true);
        const [invRes, leadsRes] = await Promise.all([
            supabase
                .from("invoices")
                .select("*, invoice_items(*)")
                .order("created_at", { ascending: false }),
            supabase.from("leads").select("*").order("company_name"),
        ]);
        const mappedInvoices = (invRes.data as any[] | null)?.map(inv => ({
            ...inv,
            items: inv.invoice_items || []
        })) || [];
        setInvoices(mappedInvoices as Invoice[]);
        setLeads((leadsRes.data as Lead[]) ?? []);
        setLoading(false);
    }, []);

    React.useEffect(() => {
        if (session?.user) loadData();
    }, [session?.user, loadData]);

    // Real-time subscription
    React.useEffect(() => {
        const channel = supabase
            .channel("invoices-changes")
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "invoices" },
                () => loadData()
            )
            .subscribe();
        return () => {
            supabase.removeChannel(channel);
        };
    }, [loadData]);

    const leadMap = React.useMemo(() => {
        const map: Record<string, Lead> = {};
        leads.forEach((l) => (map[l.id] = l));
        return map;
    }, [leads]);

    const totalAmount = items.reduce((sum, item) => sum + (item.amount || 0), 0);

    const addItem = () => {
        setItems((prev) => [...prev, { description: "", amount: 0 }]);
    };

    const removeItem = (index: number) => {
        setItems((prev) => prev.filter((_, i) => i !== index));
    };

    const updateItem = (index: number, field: keyof InvoiceItem, value: string) => {
        setItems((prev) =>
            prev.map((item, i) =>
                i === index
                    ? {
                        ...item,
                        [field]:
                            field === "amount"
                                ? parseFloat(value) || 0
                                : value,
                    }
                    : item
            )
        );
    };

    const resetForm = () => {
        setSelectedLeadId("");
        setDueDate("");
        setItems([{ description: "", amount: 0 }]);
    };

    const handleOpenEdit = (invoice: Invoice) => {
        setEditingInvoice(invoice);
        setEditDueDate(invoice.due_date ?? "");
        // Pre-populate items from stored invoice_items, or one empty row
        setEditItems(
            invoice.items && invoice.items.length > 0
                ? invoice.items.map((i) => ({ description: i.description, amount: i.amount }))
                : [{ description: "", amount: 0 }]
        );
        setEditDialogOpen(true);
    };

    const handleUpdate = async () => {
        if (!editingInvoice) return;
        const validEditItems = editItems.filter(
            (item) => item.description.trim() && item.amount > 0
        );
        if (validEditItems.length === 0) {
            toast.error("Add at least one item with a description and amount");
            return;
        }
        const newTotal = validEditItems.reduce((sum, i) => sum + i.amount, 0);

        setEditSubmitting(true);
        try {
            // 1. Update the invoice header (amount + due_date)
            const { error: invError } = await supabase
                .from("invoices")
                .update({ amount: newTotal, due_date: editDueDate || null })
                .eq("id", editingInvoice.id);
            if (invError) throw invError;

            // 2. Replace line items: delete all existing rows, then re-insert
            const { error: delError } = await supabase
                .from("invoice_items")
                .delete()
                .eq("invoice_id", editingInvoice.id);
            if (delError) throw delError;

            const { error: insertError } = await supabase
                .from("invoice_items")
                .insert(
                    validEditItems.map((item) => ({
                        invoice_id: editingInvoice.id,
                        description: item.description,
                        amount: item.amount,
                    }))
                );
            if (insertError) throw insertError;

            // 3. Update local state
            setInvoices((prev) =>
                prev.map((inv) =>
                    inv.id === editingInvoice.id
                        ? {
                            ...inv,
                            amount: newTotal,
                            due_date: editDueDate || null,
                            items: validEditItems as any,
                        }
                        : inv
                )
            );
            toast.success("Invoice updated successfully");
            setEditDialogOpen(false);
            setEditingInvoice(null);
        } catch (err: any) {
            toast.error(err.message || "Failed to update invoice");
        } finally {
            setEditSubmitting(false);
        }
    };

    const handleSubmit = async () => {
        if (!selectedLeadId) {
            toast.error("Please select a lead");
            return;
        }
        if (items.every((item) => !item.description.trim())) {
            toast.error("Add at least one invoice item");
            return;
        }
        const validItems = items.filter(
            (item) => item.description.trim() && item.amount > 0
        );
        if (validItems.length === 0) {
            toast.error("Add at least one item with a description and amount");
            return;
        }

        setSubmitting(true);
        try {
            if (!session?.access_token) {
                toast.error("Session missing. Please log in again.");
                return;
            }

            const invoiceData = {
                lead_id: selectedLeadId,
                proposal_id: "manual", // bypass required
                amount: totalAmount,
                status: "Unpaid",
                due_date: dueDate || new Date().toISOString().split("T")[0],
                currency: profile?.currency ?? "USD",
            };

            const createdInvoice = await createInvoiceAction(session.access_token, invoiceData as any, validItems);

            toast.success(`Invoice ${createdInvoice.invoice_number} created`);
            setInvoices((prev) => [{ ...createdInvoice, items: validItems as any }, ...prev]);
            setDialogOpen(false);
            resetForm();
        } catch (err: any) {
            toast.error(err.message || "Failed to create invoice");
        } finally {
            setSubmitting(false);
        }
    };

    const handleStatusToggle = async (invoice: Invoice) => {
        const newStatus: InvoiceStatus =
            invoice.status === "Paid" ? "Unpaid" : "Paid";
        // Optimistic update
        setInvoices((prev) =>
            prev.map((i) =>
                i.id === invoice.id ? { ...i, status: newStatus } : i
            )
        );
        const { error } = await supabase
            .from("invoices")
            .update({ status: newStatus })
            .eq("id", invoice.id);
        if (error) {
            toast.error("Failed to update invoice status");
            setInvoices((prev) =>
                prev.map((i) =>
                    i.id === invoice.id ? { ...i, status: invoice.status } : i
                )
            );
        } else {
            toast.success(`Invoice marked as ${newStatus}`);
        }
    };

    const handleSendEmail = async (invoice: Invoice) => {
        const lead = leadMap[invoice.lead_id];
        if (!lead?.email) {
            toast.error("This lead does not have an email address.");
            return;
        }

        if (!profile?.resend_key) {
            toast.error("Please configure your Resend API Key in Settings first.");
            return;
        }

        setSendingEmailId(invoice.id);
        try {
            await sendInvoiceEmailAction(profile.resend_key, lead.email, invoice);
            toast.success(`Invoice sent to ${lead.email}`);
        } catch (e: any) {
            toast.error("Failed to send email: " + (e.message || "Unknown error"));
        } finally {
            setSendingEmailId(null);
        }
    };

    const handlePromptDelete = (invoice: Invoice) => {
        // If Draft or Unpaid (assuming Unpaid acts as draft/sent in legacy schema)
        if (invoice.status === "Unpaid" || invoice.status === ("Draft" as any)) {
            setDeleteType("delete");
        } else {
            setDeleteType("void");
        }
        setDeleteData(invoice);
    };

    const handleConfirmDelete = async () => {
        if (!deleteData) return;
        try {
            if (deleteType === "delete") {
                const { error } = await supabase.from("invoices").delete().eq("id", deleteData.id);
                if (error) throw error;
                setInvoices((prev) => prev.filter((i) => i.id !== deleteData.id));
                toast.success("Invoice permanently deleted");
            } else {
                const { error } = await supabase.from("invoices").update({ status: "Void" }).eq("id", deleteData.id);
                if (error) throw error;
                setInvoices((prev) => prev.map((i) => i.id === deleteData.id ? { ...i, status: "Void" } : i));
                toast.success("Invoice has been voided");
            }
        } catch (err: any) {
            toast.error(err.message || "Failed to process request");
        }
    };

    const handleDownload = async (invoice: Invoice) => {
        setDownloadingId(invoice.id);
        try {
            const lead = leadMap[invoice.lead_id];
            // Use stored invoice_items if available, otherwise fall back to a single summary line
            const lineItems = invoice.items && invoice.items.length > 0
                ? invoice.items.map((item) => ({
                    description: item.description,
                    amount: item.amount,
                }))
                : [{ description: `Invoice ${invoice.invoice_number}`, amount: invoice.amount ?? 0 }];
            const doc = generateInvoicePdf({
                agencyName: profile?.agency_name || "AutoFlow Agency",
                invoiceNumber: invoice.invoice_number || "INV-001",
                leadCompanyName: lead?.company_name || "",
                leadContactName: lead?.contact_name || "",
                leadEmail: lead?.email || "",
                items: lineItems,
                total: invoice.amount ?? 0,
                status: invoice.status || "Unpaid",
                dueDate: invoice.due_date,
                currency: invoice.currency || "USD",
                primaryColor: profile?.brand_colors?.primary || "#4f46e5",
            });
            doc.save(`${invoice.invoice_number || "invoice"}.pdf`);
            toast.success("Invoice PDF downloaded");
        } catch {
            toast.error("Failed to generate PDF");
        } finally {
            setDownloadingId(null);
        }
    };

    const currency = profile?.currency ?? "USD";
    const totalRevenue = invoices
        .filter((i) => i.status === "Paid")
        .reduce((sum, i) => sum + (i.amount ?? 0), 0);
    const pendingPayments = invoices
        .filter((i) => i.status === "Unpaid")
        .reduce((sum, i) => sum + (i.amount ?? 0), 0);

    return (
        <div className="space-y-5">
            {/* KPI summary */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Card className="p-4">
                    <p className="text-xs font-medium text-muted-foreground">Total Revenue</p>
                    <p className="mt-1 text-xl font-bold text-emerald-600 dark:text-emerald-400">
                        {loading ? (
                            <Skeleton className="h-6 w-24" />
                        ) : (
                            formatCurrency(totalRevenue, currency)
                        )}
                    </p>
                </Card>
                <Card className="p-4">
                    <p className="text-xs font-medium text-muted-foreground">
                        Pending Payments
                    </p>
                    <p className="mt-1 text-xl font-bold text-amber-600 dark:text-amber-400">
                        {loading ? (
                            <Skeleton className="h-6 w-24" />
                        ) : (
                            formatCurrency(pendingPayments, currency)
                        )}
                    </p>
                </Card>
                <Card className="p-4">
                    <p className="text-xs font-medium text-muted-foreground">
                        Total Invoices
                    </p>
                    <p className="mt-1 text-xl font-bold text-foreground">
                        {loading ? <Skeleton className="h-6 w-12" /> : invoices.length}
                    </p>
                </Card>
            </div>

            {/* Header */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-lg font-semibold text-foreground">
                    Invoices
                    {!loading && (
                        <span className="ml-2 text-sm font-normal text-muted-foreground">
                            ({invoices.length})
                        </span>
                    )}
                </h2>
                <Button
                    onClick={() => setDialogOpen(true)}
                    size="sm"
                    className="bg-indigo-600 hover:bg-indigo-700"
                    disabled={leads.length === 0}
                >
                    <Plus className="mr-1.5 h-4 w-4" />
                    Create Invoice
                </Button>
            </div>

            {leads.length === 0 && !loading && (
                <Card className="border-amber-200 bg-amber-50 p-4 dark:border-amber-500/20 dark:bg-amber-500/10">
                    <p className="text-sm text-amber-700 dark:text-amber-300">
                        You need at least one lead before creating an invoice. Add leads
                        from the Leads page first.
                    </p>
                </Card>
            )}

            {/* Table */}
            <Card className="overflow-hidden">
                {loading ? (
                    <div className="p-4">
                        <div className="space-y-3">
                            {Array.from({ length: 5 }).map((_, i) => (
                                <Skeleton key={i} className="h-12 w-full" />
                            ))}
                        </div>
                    </div>
                ) : invoices.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
                            <Receipt className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <h3 className="text-base font-semibold text-foreground">
                            No invoices yet
                        </h3>
                        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                            Create your first invoice to start tracking payments and revenue.
                        </p>
                        <Button
                            onClick={() => setDialogOpen(true)}
                            size="sm"
                            className="mt-4 bg-indigo-600 hover:bg-indigo-700"
                            disabled={leads.length === 0}
                        >
                            <Plus className="mr-1.5 h-4 w-4" />
                            Create Invoice
                        </Button>
                    </div>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-muted/50 hover:bg-muted/50">
                                <TableHead>Invoice #</TableHead>
                                <TableHead>Client</TableHead>
                                <TableHead className="hidden sm:table-cell">Due Date</TableHead>
                                <TableHead>Amount</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {invoices.map((invoice) => {
                                const lead = leadMap[invoice.lead_id];
                                return (
                                    <TableRow key={invoice.id}>
                                        <TableCell>
                                            <span className="font-mono text-sm font-medium text-foreground">
                                                {invoice.invoice_number || "—"}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-sm text-muted-foreground">
                                            {lead?.company_name || "—"}
                                        </TableCell>
                                        <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">
                                            {formatDate(invoice.due_date)}
                                        </TableCell>
                                        <TableCell className="text-sm font-medium text-foreground">
                                            {formatCurrency(invoice.amount ?? 0, (invoice.currency || "USD") as Currency)}
                                        </TableCell>
                                        <TableCell>
                                            <button
                                                onClick={() => handleStatusToggle(invoice)}
                                                className="transition-transform hover:scale-105"
                                                title="Click to toggle paid/unpaid"
                                            >
                                                <InvoiceStatusBadge status={invoice.status} />
                                            </button>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleStatusToggle(invoice)}
                                                >
                                                    {invoice.status === "Paid" ? "Mark Unpaid" : "Mark Paid"}
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    title="Edit line items"
                                                    onClick={() => handleOpenEdit(invoice)}
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleDownload(invoice)}
                                                    disabled={downloadingId === invoice.id}
                                                    title="Download PDF"
                                                >
                                                    {downloadingId === invoice.id ? (
                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                    ) : (
                                                        <Download className="h-4 w-4" />
                                                    )}
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleSendEmail(invoice)}
                                                    disabled={sendingEmailId === invoice.id || !leadMap[invoice.lead_id]?.email}
                                                    title={!leadMap[invoice.lead_id]?.email ? "Lead has no email" : "Send to Client"}
                                                >
                                                    {sendingEmailId === invoice.id ? (
                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                    ) : (
                                                        <Send className="h-4 w-4" />
                                                    )}
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="hover:bg-destructive/10 hover:text-destructive"
                                                    onClick={() => handlePromptDelete(invoice)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                )}
            </Card>

            {/* Create Invoice Dialog */}
            <Dialog
                open={dialogOpen}
                onOpenChange={(open) => {
                    setDialogOpen(open);
                    if (!open) resetForm();
                }}
            >
                <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[600px]">
                    <DialogHeader>
                        <DialogTitle>Create Invoice</DialogTitle>
                        <DialogDescription>
                            The next sequential invoice number will be auto-assigned implicitly.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <Label>
                                Select Lead <span className="text-destructive">*</span>
                            </Label>
                            <Select
                                value={selectedLeadId}
                                onValueChange={setSelectedLeadId}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Choose a lead…" />
                                </SelectTrigger>
                                <SelectContent>
                                    {leads.map((lead) => (
                                        <SelectItem key={lead.id} value={lead.id}>
                                            {lead.company_name} — {lead.contact_name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="due_date">Due Date</Label>
                            <Input
                                id="due_date"
                                type="date"
                                value={dueDate}
                                onChange={(e) => setDueDate(e.target.value)}
                            />
                        </div>

                        {/* Items */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label>Invoice Items</Label>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={addItem}
                                >
                                    <Plus className="mr-1 h-3.5 w-3.5" />
                                    Add Item
                                </Button>
                            </div>
                            <div className="space-y-2">
                                {items.map((item, index) => (
                                    <div key={index} className="flex items-start gap-2">
                                        <Input
                                            placeholder="Item description"
                                            value={item.description}
                                            onChange={(e) =>
                                                updateItem(index, "description", e.target.value)
                                            }
                                            className="flex-1"
                                        />
                                        <Input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            placeholder="Amount"
                                            value={item.amount || ""}
                                            onChange={(e) =>
                                                updateItem(index, "amount", e.target.value)
                                            }
                                            className="w-28"
                                        />
                                        {items.length > 1 && (
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => removeItem(index)}
                                                className="h-10 w-10 shrink-0 text-muted-foreground hover:text-destructive"
                                            >
                                                <X className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Total */}
                        <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
                            <span className="text-sm font-medium text-foreground">
                                Total Amount
                            </span>
                            <span className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
                                {formatCurrency(totalAmount, currency)}
                            </span>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setDialogOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSubmit}
                            disabled={submitting}
                            className="bg-indigo-600 hover:bg-indigo-700"
                        >
                            {submitting && (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            )}
                            Create Invoice
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <ConfirmDialog
                open={!!deleteData}
                onOpenChange={(v) => !v && setDeleteData(null)}
                title={deleteType === "delete" ? "Delete Invoice" : "Void Invoice"}
                description={
                    deleteType === "delete"
                        ? "Are you sure you want to permanently delete this invoice? This action cannot be undone."
                        : "This invoice has been sent or paid. It cannot be hard-deleted. Do you want to Void it instead?"
                }
                confirmText={deleteType === "delete" ? "Delete" : "Void Invoice"}
                variant={deleteType === "delete" ? "danger" : "warning"}
                onConfirm={handleConfirmDelete}
            />

            {/* Edit Invoice Dialog */}
            <Dialog
                open={editDialogOpen}
                onOpenChange={(open) => {
                    setEditDialogOpen(open);
                    if (!open) setEditingInvoice(null);
                }}
            >
                <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[600px]">
                    <DialogHeader>
                        <DialogTitle>Edit Invoice</DialogTitle>
                        <DialogDescription>
                            Editing{" "}
                            <span className="font-mono font-medium text-indigo-600">
                                {editingInvoice?.invoice_number}
                            </span>
                            . Line items will be replaced on save.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="edit_due_date">Due Date</Label>
                            <Input
                                id="edit_due_date"
                                type="date"
                                value={editDueDate}
                                onChange={(e) => setEditDueDate(e.target.value)}
                            />
                        </div>

                        {/* Items */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label>Invoice Items</Label>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                        setEditItems((prev) => [...prev, { description: "", amount: 0 }])
                                    }
                                >
                                    <Plus className="mr-1 h-3.5 w-3.5" />
                                    Add Item
                                </Button>
                            </div>
                            <div className="space-y-2">
                                {editItems.map((item, index) => (
                                    <div key={index} className="flex items-start gap-2">
                                        <Input
                                            placeholder="Item description"
                                            value={item.description}
                                            onChange={(e) =>
                                                setEditItems((prev) =>
                                                    prev.map((it, i) =>
                                                        i === index ? { ...it, description: e.target.value } : it
                                                    )
                                                )
                                            }
                                            className="flex-1"
                                        />
                                        <Input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            placeholder="Amount"
                                            value={item.amount || ""}
                                            onChange={(e) =>
                                                setEditItems((prev) =>
                                                    prev.map((it, i) =>
                                                        i === index
                                                            ? { ...it, amount: parseFloat(e.target.value) || 0 }
                                                            : it
                                                    )
                                                )
                                            }
                                            className="w-28"
                                        />
                                        {editItems.length > 1 && (
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                onClick={() =>
                                                    setEditItems((prev) => prev.filter((_, i) => i !== index))
                                                }
                                                className="h-10 w-10 shrink-0 text-muted-foreground hover:text-destructive"
                                            >
                                                <X className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Total */}
                        <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
                            <span className="text-sm font-medium text-foreground">New Total</span>
                            <span className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
                                {formatCurrency(
                                    editItems.reduce((sum, i) => sum + (i.amount || 0), 0),
                                    currency
                                )}
                            </span>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setEditDialogOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleUpdate}
                            disabled={editSubmitting}
                            className="bg-indigo-600 hover:bg-indigo-700"
                        >
                            {editSubmitting && (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            )}
                            Save Changes
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

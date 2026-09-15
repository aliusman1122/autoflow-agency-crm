"use client";

import * as React from "react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Currency } from "@/lib/types";
import {
    Plus,
    FileText,
    Download,
    Loader2,
    CheckCircle2,
    XCircle,
    Send,
    FileEdit,
    Trash2,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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
import { ProposalStatusBadge } from "@/components/status-badges";
import { generateProposalPdf } from "@/lib/pdf";
import { formatCurrency, formatDate } from "@/lib/format";
import type { Lead, Proposal, ProposalStatus } from "@/lib/types";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { sendProposalEmailAction } from "../actions/email";
import { autoCreateInvoiceAction } from "../actions/invoice";


const PROPOSAL_STATUSES: ProposalStatus[] = [
    "Draft",
    "Sent",
    "Accepted",
    "Rejected",
];

const proposalSchema = z.object({
    lead_id: z.string().min(1, "Please select a lead"),
    title: z.string().min(1, "Title is required"),
    scope: z.string().min(1, "Scope is required"),
    deliverables: z.string().min(1, "Deliverables are required"),
    timeline: z.string().min(1, "Timeline is required"),
    pricing: z.coerce.number().min(0, "Pricing must be a positive number"),
});

type ProposalFormValues = z.infer<typeof proposalSchema>;

export default function ProposalsPage() {
    const { profile, session } = useAuth();
    const [proposals, setProposals] = React.useState<Proposal[]>([]);
    const [leads, setLeads] = React.useState<Lead[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [dialogOpen, setDialogOpen] = React.useState(false);
    const [submitting, setSubmitting] = React.useState(false);
    const [downloadingId, setDownloadingId] = React.useState<string | null>(null);
    const [sendingEmailId, setSendingEmailId] = React.useState<string | null>(null);
    const [loadingProposalId, setLoadingProposalId] = React.useState<string | null>(null);
    const [selectedLeadId, setSelectedLeadId] = React.useState("");

    const [deleteData, setDeleteData] = React.useState<Proposal | null>(null);

    const {
        register,
        handleSubmit,
        reset,
        setValue,
        watch,
        formState: { errors },
    } = useForm<ProposalFormValues>({
        resolver: zodResolver(proposalSchema),
        defaultValues: {
            lead_id: "",
            title: "",
            scope: "",
            deliverables: "",
            timeline: "",
            pricing: 0,
        },
    });

    const watchLeadId = watch("lead_id");

    const loadData = React.useCallback(async () => {
        setLoading(true);
        const [propRes, leadsRes] = await Promise.all([
            supabase
                .from("proposals")
                .select("*")
                .order("created_at", { ascending: false }),
            supabase.from("leads").select("*").order("company_name"),
        ]);
        setProposals((propRes.data as Proposal[]) ?? []);
        setLeads((leadsRes.data as Lead[]) ?? []);
        setLoading(false);
    }, []);

    React.useEffect(() => {
        if (session?.user) loadData();
    }, [session?.user, loadData]);

    // Real-time subscription
    React.useEffect(() => {
        const channel = supabase
            .channel("proposals-changes")
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "proposals" },
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

    const onSubmit = async (values: ProposalFormValues) => {
        setSubmitting(true);
        try {
            const { data, error } = await supabase
                .from("proposals")
                .insert({
                    lead_id: values.lead_id,
                    title: values.title,
                    scope: values.scope,
                    deliverables: values.deliverables,
                    timeline: values.timeline,
                    pricing: values.pricing,
                    status: "Draft",
                    currency: profile?.currency ?? "USD",
                })
                .select("*")
                .maybeSingle();
            if (error) throw error;
            toast.success("Proposal created successfully");
            setProposals((prev) => [data as Proposal, ...prev]);
            setDialogOpen(false);
            reset();
            setSelectedLeadId("");
        } catch (err: any) {
            toast.error(err.message || "Failed to create proposal");
        } finally {
            setSubmitting(false);
        }
    };

    const handleStatusChange = async (
        proposal: Proposal,
        newStatus: ProposalStatus
    ) => {
        // Optimistic update
        setProposals((prev) =>
            prev.map((p) => (p.id === proposal.id ? { ...p, status: newStatus } : p))
        );
        const { error } = await supabase
            .from("proposals")
            .update({ status: newStatus })
            .eq("id", proposal.id);
        if (error) {
            toast.error("Failed to update status");
            setProposals((prev) =>
                prev.map((p) =>
                    p.id === proposal.id ? { ...p, status: proposal.status } : p
                )
            );
        } else {
            toast.success(`Proposal marked as ${newStatus}`);

            // Auto-create invoice if accepted
            if (newStatus === "Accepted" && proposal.status !== "Accepted") {
                setLoadingProposalId(proposal.id);
                try {
                    if (!session?.access_token) {
                        toast.error("Session missing. Please log in again.");
                        return;
                    }
                    const invData = await autoCreateInvoiceAction(session.access_token, proposal);
                    toast.success(
                        <div className="flex flex-col gap-1">
                            <span>Invoice {invData.invoice_number} auto-created</span>
                            <a href="/invoices" className="text-xs text-indigo-400 hover:underline">View invoices</a>
                        </div>
                    );

                } catch (e: any) {
                    console.error("Failed to create auto-invoice", e);
                    toast.error("Failed to auto-create invoice: " + (e.message || 'Unknown error'));
                } finally {
                    setLoadingProposalId(null);
                }
            }
        }
    };

    const handleSendEmail = async (proposal: Proposal) => {
        const lead = leadMap[proposal.lead_id];
        if (!lead?.email) {
            toast.error("This lead does not have an email address.");
            return;
        }

        if (!profile?.resend_key) {
            toast.error("Please configure your Resend API Key in Settings first.");
            return;
        }

        setSendingEmailId(proposal.id);
        try {
            await sendProposalEmailAction(profile.resend_key, lead.email, proposal);
            toast.success(`Proposal sent to ${lead.email}`);

            if (proposal.status === "Draft") {
                handleStatusChange(proposal, "Sent");
            }
        } catch (e: any) {
            toast.error("Failed to send email: " + (e.message || "Unknown error"));
        } finally {
            setSendingEmailId(null);
        }
    };

    const handleConfirmDelete = async () => {
        if (!deleteData) return;
        try {
            const { error } = await supabase.from("proposals").delete().eq("id", deleteData.id);
            if (error) throw error;
            setProposals((prev) => prev.filter((p) => p.id !== deleteData.id));
            toast.success("Proposal permanently deleted");
        } catch (err: any) {
            toast.error(err.message || "Failed to delete proposal");
        }
    };

    const handleDownload = async (proposal: Proposal) => {
        setDownloadingId(proposal.id);
        try {
            const lead = leadMap[proposal.lead_id];
            const doc = generateProposalPdf({
                agencyName: profile?.agency_name || "AutoFlow Agency",
                leadCompanyName: lead?.company_name || "",
                leadContactName: lead?.contact_name || "",
                leadEmail: lead?.email || "",
                title: proposal.title || "",
                scope: proposal.scope || "",
                deliverables: proposal.deliverables || "",
                timeline: proposal.timeline || "",
                pricing: proposal.pricing ?? 0,
                currency: proposal.currency || "USD",
                primaryColor:
                    profile?.brand_colors?.primary || "#4f46e5",
            });
            doc.save(`${proposal.title || "proposal"}.pdf`);
            toast.success("PDF downloaded");
        } catch {
            toast.error("Failed to generate PDF");
        } finally {
            setDownloadingId(null);
        }
    };

    const currency = profile?.currency ?? "USD";

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-lg font-semibold text-foreground">
                    Proposals
                    {!loading && (
                        <span className="ml-2 text-sm font-normal text-muted-foreground">
                            ({proposals.length})
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
                    Create Proposal
                </Button>
            </div>

            {leads.length === 0 && !loading && (
                <Card className="border-amber-200 bg-amber-50 p-4 dark:border-amber-500/20 dark:bg-amber-500/10">
                    <p className="text-sm text-amber-700 dark:text-amber-300">
                        You need at least one lead before creating a proposal. Add leads
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
                ) : proposals.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
                            <FileText className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <h3 className="text-base font-semibold text-foreground">
                            No proposals yet
                        </h3>
                        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                            Create your first proposal to start tracking your agency&apos;s
                            engagements.
                        </p>
                        <Button
                            onClick={() => setDialogOpen(true)}
                            size="sm"
                            className="mt-4 bg-indigo-600 hover:bg-indigo-700"
                            disabled={leads.length === 0}
                        >
                            <Plus className="mr-1.5 h-4 w-4" />
                            Create Proposal
                        </Button>
                    </div>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-muted/50 hover:bg-muted/50">
                                <TableHead>Title</TableHead>
                                <TableHead>Client</TableHead>
                                <TableHead className="hidden sm:table-cell">Timeline</TableHead>
                                <TableHead>Pricing</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {proposals.map((proposal) => {
                                const lead = leadMap[proposal.lead_id];
                                return (
                                    <TableRow key={proposal.id}>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-500/10">
                                                    <FileText className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="truncate text-sm font-medium text-foreground">
                                                        {proposal.title || "Untitled"}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {formatDate(proposal.created_at)}
                                                    </p>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-sm text-muted-foreground">
                                            {lead?.company_name || "—"}
                                        </TableCell>
                                        <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">
                                            {proposal.timeline || "—"}
                                        </TableCell>
                                        <TableCell className="text-sm font-medium text-foreground">
                                            {formatCurrency(proposal.pricing ?? 0, (proposal.currency || "USD") as Currency)}
                                        </TableCell>
                                        <TableCell>
                                            <ProposalStatusBadge status={proposal.status} />
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="sm" disabled={loadingProposalId === proposal.id}>
                                                            <FileEdit className="h-4 w-4" />
                                                            <span className="ml-1 hidden sm:inline">Status</span>
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        {PROPOSAL_STATUSES.map((s) => (
                                                            <DropdownMenuItem
                                                                key={s}
                                                                onClick={() => handleStatusChange(proposal, s)}
                                                                className="gap-2"
                                                            >
                                                                {s === "Accepted" && (
                                                                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                                                                )}
                                                                {s === "Rejected" && (
                                                                    <XCircle className="h-3.5 w-3.5 text-rose-500" />
                                                                )}
                                                                {s === "Sent" && (
                                                                    <Send className="h-3.5 w-3.5 text-blue-500" />
                                                                )}
                                                                {s === "Draft" && (
                                                                    <FileEdit className="h-3.5 w-3.5 text-slate-500" />
                                                                )}
                                                                {s}
                                                            </DropdownMenuItem>
                                                        ))}
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleDownload(proposal)}
                                                    disabled={downloadingId === proposal.id}
                                                    title="Download PDF"
                                                >
                                                    {downloadingId === proposal.id ? (
                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                    ) : (
                                                        <Download className="h-4 w-4" />
                                                    )}
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleSendEmail(proposal)}
                                                    disabled={sendingEmailId === proposal.id || !leadMap[proposal.lead_id]?.email}
                                                    title={!leadMap[proposal.lead_id]?.email ? "Lead has no email" : "Send to Client"}
                                                >
                                                    {sendingEmailId === proposal.id ? (
                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                    ) : (
                                                        <Send className="h-4 w-4" />
                                                    )}
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="hover:bg-destructive/10 hover:text-destructive"
                                                    onClick={() => setDeleteData(proposal)}
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

            {/* Create Proposal Dialog */}
            <Dialog
                open={dialogOpen}
                onOpenChange={(open) => {
                    setDialogOpen(open);
                    if (!open) {
                        reset();
                        setSelectedLeadId("");
                    }
                }}
            >
                <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[600px]">
                    <DialogHeader>
                        <DialogTitle>Create Proposal</DialogTitle>
                        <DialogDescription>
                            Generate a professional proposal for your client.
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                        <div className="space-y-1.5">
                            <Label>
                                Select Lead <span className="text-destructive">*</span>
                            </Label>
                            <Select
                                value={watchLeadId}
                                onValueChange={(v) => {
                                    setValue("lead_id", v);
                                    setSelectedLeadId(v);
                                }}
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
                            {errors.lead_id && (
                                <p className="text-xs text-destructive">
                                    {errors.lead_id.message}
                                </p>
                            )}
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="title">
                                Title <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                id="title"
                                placeholder="AI Chatbot Implementation"
                                {...register("title")}
                            />
                            {errors.title && (
                                <p className="text-xs text-destructive">
                                    {errors.title.message}
                                </p>
                            )}
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="scope">
                                Scope <span className="text-destructive">*</span>
                            </Label>
                            <Textarea
                                id="scope"
                                rows={3}
                                placeholder="Describe the overall project scope and objectives…"
                                {...register("scope")}
                            />
                            {errors.scope && (
                                <p className="text-xs text-destructive">
                                    {errors.scope.message}
                                </p>
                            )}
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="deliverables">
                                Deliverables <span className="text-destructive">*</span>
                            </Label>
                            <Textarea
                                id="deliverables"
                                rows={4}
                                placeholder="List the specific deliverables, one per line…"
                                {...register("deliverables")}
                            />
                            {errors.deliverables && (
                                <p className="text-xs text-destructive">
                                    {errors.deliverables.message}
                                </p>
                            )}
                        </div>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div className="space-y-1.5">
                                <Label htmlFor="timeline">
                                    Timeline <span className="text-destructive">*</span>
                                </Label>
                                <Input
                                    id="timeline"
                                    placeholder="4-6 weeks"
                                    {...register("timeline")}
                                />
                                {errors.timeline && (
                                    <p className="text-xs text-destructive">
                                        {errors.timeline.message}
                                    </p>
                                )}
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="pricing">
                                    Pricing ({profile?.currency ?? "USD"}) <span className="text-destructive">*</span>
                                </Label>
                                <Input
                                    id="pricing"
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    placeholder="5000"
                                    {...register("pricing")}
                                />
                                {errors.pricing && (
                                    <p className="text-xs text-destructive">
                                        {errors.pricing.message}
                                    </p>
                                )}
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
                                type="submit"
                                disabled={submitting}
                                className="bg-indigo-600 hover:bg-indigo-700"
                            >
                                {submitting && (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                )}
                                Create Proposal
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <ConfirmDialog
                open={!!deleteData}
                onOpenChange={(v) => !v && setDeleteData(null)}
                title="Delete Proposal"
                description="Are you sure you want to permanently delete this proposal? This action cannot be undone."
                confirmText="Delete"
                variant="danger"
                onConfirm={handleConfirmDelete}
            />
        </div>
    );
}

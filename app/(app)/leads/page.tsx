"use client";

import * as React from "react";
import { toast } from "sonner";
import {
    Plus,
    Search,
    Upload,
    MapPin,
    Linkedin,
    Users,
    Sparkles,
    Building2,
    Filter,
    MoreHorizontal,
    Trash2,
    Archive,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Tabs,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusBadge, PipelineBadge } from "@/components/status-badges";
import { AddLeadDialog } from "@/components/add-lead-dialog";
import { ImportCsvDialog } from "@/components/import-csv-dialog";
import { LeadDrawer } from "@/components/lead-drawer";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
    LEAD_STATUSES,
    INDUSTRIES,
    PIPELINE_STAGES,
    type Lead,
} from "@/lib/types";
import { SAMPLE_LEADS } from "@/lib/sample-data";
import { useLeadsStore } from "@/lib/store";

type LeadAction =
    | { kind: "delete"; lead: Lead }
    | { kind: "archive"; lead: Lead }
    | { kind: "restore"; lead: Lead }
    | { kind: "won-delete-blocked"; lead: Lead; hasDeps: boolean }
    | null;

export default function LeadsPage() {
    const { session } = useAuth();
    const { leads: globalLeads, loading, fetchLeads, archiveLead, restoreLead, deleteLead } = useLeadsStore();

    const [search, setSearch] = React.useState("");
    const [statusFilter, setStatusFilter] = React.useState<string>("all");
    const [industryFilter, setIndustryFilter] = React.useState<string>("all");
    const [addOpen, setAddOpen] = React.useState(false);
    const [csvOpen, setCsvOpen] = React.useState(false);
    const [selectedLead, setSelectedLead] = React.useState<Lead | null>(null);
    const [drawerOpen, setDrawerOpen] = React.useState(false);

    // Delete / archive modal state
    const [action, setAction] = React.useState<LeadAction>(null);
    const [viewMode, setViewMode] = React.useState<"active" | "archived">("active");

    const leads = React.useMemo(() => {
        return globalLeads.filter((l: Lead) => viewMode === "archived" ? l.is_archived === true : !l.is_archived);
    }, [globalLeads, viewMode]);

    React.useEffect(() => {
        if (session?.user) {
            fetchLeads().then(() => {
                // Seed sample leads only on first active-tab load when there are none.
                if (useLeadsStore.getState().leads.length === 0 && viewMode === "active") {
                    supabase.from("leads").insert(SAMPLE_LEADS).select("*").then(({ data: seeded, error: seedError }: { data: any, error: any }) => {
                        if (seedError) {
                            console.error("Seed error:", seedError.message);
                        } else if (seeded) {
                            fetchLeads(true);
                            toast.success("We've added 8 sample leads to get you started");
                        }
                    });
                }
            });
        }
    }, [session?.user, fetchLeads, viewMode]);

    // Real-time subscription
    React.useEffect(() => {
        const channel = supabase
            .channel("leads-changes")
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "leads" },
                () => fetchLeads(true)
            )
            .subscribe();
        return () => {
            supabase.removeChannel(channel);
        };
    }, [fetchLeads]);

    const filteredLeads = React.useMemo(() => {
        return leads.filter((lead) => {
            const matchesSearch =
                !search ||
                [lead.company_name, lead.contact_name, lead.email, lead.phone]
                    .filter(Boolean)
                    .some((field) =>
                        field!.toLowerCase().includes(search.toLowerCase())
                    );
            const matchesStatus =
                statusFilter === "all" || lead.status === statusFilter;
            const matchesIndustry =
                industryFilter === "all" || lead.industry === industryFilter;
            return matchesSearch && matchesStatus && matchesIndustry;
        });
    }, [leads, search, statusFilter, industryFilter]);

    const handleRowClick = (lead: Lead) => {
        setSelectedLead(lead);
        setDrawerOpen(true);
    };

    const handleLeadAdded = (lead: Lead) => {
        useLeadsStore.getState().addLeadLocally(lead);
    };

    const handleLeadUpdated = (updated: Lead) => {
        useLeadsStore.getState().updateLeadLocally(updated.id, updated);
        setSelectedLead(updated);
    };

    const handleComingSoon = (feature: string) => {
        toast.info(`${feature} is coming soon! Stay tuned.`);
    };

    /** Check for active proposals/invoices linked to this lead */
    const checkDependencies = async (leadId: string) => {
        const [propRes, invRes] = await Promise.all([
            supabase.from("proposals").select("id").eq("lead_id", leadId).limit(1),
            supabase.from("invoices").select("id").eq("lead_id", leadId).limit(1),
        ]);
        const hasProposals = (propRes.data?.length ?? 0) > 0;
        const hasInvoices = (invRes.data?.length ?? 0) > 0;
        return hasProposals || hasInvoices;
    };

    /** Clicking the three-dots "Delete" option */
    const handleDeleteClick = async (
        e: React.MouseEvent,
        lead: Lead
    ) => {
        e.stopPropagation();
        if (lead.pipeline_stage === "Won") {
            // "Won" leads are clients — check dependencies before allowing hard delete
            const hasDeps = await checkDependencies(lead.id);
            if (hasDeps) {
                setAction({ kind: "won-delete-blocked", lead, hasDeps: true });
                return;
            }
        }
        setAction({ kind: "delete", lead });
    };

    /** Clicking the three-dots "Archive" option */
    const handleArchiveClick = (e: React.MouseEvent, lead: Lead) => {
        e.stopPropagation();
        setAction({ kind: "archive", lead });
    };

    const handleConfirmDelete = async () => {
        if (!action || action.kind !== "delete") return;
        await deleteLead(action.lead);
        setAction(null);
    };

    const handleConfirmArchiveToggle = async () => {
        if (!action || (action.kind !== "archive" && action.kind !== "won-delete-blocked" && action.kind !== "restore")) return;
        const lead = action.lead;
        const isArchiving = action.kind !== "restore";

        try {
            if (isArchiving) {
                await archiveLead(lead);
            } else {
                await restoreLead(lead);
            }
        } finally {
            setAction(null);
        }
    };

    return (
        <div className="space-y-5">
            {/* Header actions */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold text-foreground">
                        All Leads
                        {!loading && (
                            <span className="ml-2 text-sm font-normal text-muted-foreground">
                                ({filteredLeads.length})
                            </span>
                        )}
                    </h2>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleComingSoon("Google Maps Import")}
                    >
                        <MapPin className="mr-1.5 h-4 w-4" />
                        <span className="hidden sm:inline">Google Maps</span> Import
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleComingSoon("LinkedIn Import")}
                    >
                        <Linkedin className="mr-1.5 h-4 w-4" />
                        <span className="hidden sm:inline">LinkedIn</span> Import
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCsvOpen(true)}
                    >
                        <Upload className="mr-1.5 h-4 w-4" />
                        Import CSV
                    </Button>
                    <Button
                        size="sm"
                        onClick={() => setAddOpen(true)}
                        className="bg-indigo-600 hover:bg-indigo-700"
                    >
                        <Plus className="mr-1.5 h-4 w-4" />
                        Add Lead
                    </Button>
                </div>
            </div>

            {/* Search & filters */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Tabs value={viewMode} onValueChange={(v: any) => setViewMode(v)}>
                    <TabsList className="mb-0 h-9">
                        <TabsTrigger value="active" className="text-xs">Active leads</TabsTrigger>
                        <TabsTrigger value="archived" className="text-xs">Archived</TabsTrigger>
                    </TabsList>
                </Tabs>
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        placeholder="Search by company, contact, email, or phone…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-10"
                    />
                </div>
                <div className="flex gap-2">
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-[130px]">
                            <Filter className="mr-1.5 h-3.5 w-3.5" />
                            <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Statuses</SelectItem>
                            {LEAD_STATUSES.map((s) => (
                                <SelectItem key={s} value={s}>
                                    {s}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Select value={industryFilter} onValueChange={setIndustryFilter}>
                        <SelectTrigger className="w-[150px]">
                            <SelectValue placeholder="Industry" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Industries</SelectItem>
                            {INDUSTRIES.map((ind) => (
                                <SelectItem key={ind} value={ind}>
                                    {ind}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Table */}
            <Card className="overflow-hidden">
                {loading ? (
                    <div className="p-4">
                        <div className="space-y-3">
                            {Array.from({ length: 6 }).map((_, i) => (
                                <Skeleton key={i} className="h-12 w-full" />
                            ))}
                        </div>
                    </div>
                ) : filteredLeads.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
                            <Users className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <h3 className="text-base font-semibold text-foreground">
                            {leads.length === 0 ? "No leads yet" : "No leads match your filters"}
                        </h3>
                        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                            {leads.length === 0
                                ? "Add your first lead or import from CSV to get started."
                                : "Try adjusting your search or filter criteria."}
                        </p>
                        {leads.length === 0 && (
                            <div className="mt-4 flex gap-2">
                                <Button
                                    size="sm"
                                    onClick={() => setAddOpen(true)}
                                    className="bg-indigo-600 hover:bg-indigo-700"
                                >
                                    <Plus className="mr-1.5 h-4 w-4" />
                                    Add Lead
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setCsvOpen(true)}
                                >
                                    <Upload className="mr-1.5 h-4 w-4" />
                                    Import CSV
                                </Button>
                            </div>
                        )}
                    </div>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-muted/50 hover:bg-muted/50">
                                <TableHead>Company</TableHead>
                                <TableHead>Contact</TableHead>
                                <TableHead className="hidden md:table-cell">Email</TableHead>
                                <TableHead className="hidden lg:table-cell">Phone</TableHead>
                                <TableHead className="hidden sm:table-cell">Industry</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="hidden md:table-cell">
                                    Pipeline Stage
                                </TableHead>
                                <TableHead className="w-10" />
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredLeads.map((lead) => (
                                <TableRow
                                    key={lead.id}
                                    onClick={() => handleRowClick(lead)}
                                    className="group cursor-pointer"
                                >
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-500/10">
                                                <Building2 className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                                            </div>
                                            <span className="font-medium text-foreground">
                                                {lead.company_name || "—"}
                                            </span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">
                                        {lead.contact_name || "—"}
                                    </TableCell>
                                    <TableCell className="hidden text-muted-foreground md:table-cell">
                                        {lead.email || "—"}
                                    </TableCell>
                                    <TableCell className="hidden text-muted-foreground lg:table-cell">
                                        {lead.phone || "—"}
                                    </TableCell>
                                    <TableCell className="hidden text-muted-foreground sm:table-cell">
                                        {lead.industry || "—"}
                                    </TableCell>
                                    <TableCell>
                                        <StatusBadge status={lead.status} />
                                    </TableCell>
                                    <TableCell className="hidden md:table-cell">
                                        <PipelineBadge stage={lead.pipeline_stage} />
                                    </TableCell>
                                    <TableCell onClick={(e) => e.stopPropagation()}>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 opacity-0 group-hover:opacity-100"
                                                >
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                {viewMode === "active" ? (
                                                    <DropdownMenuItem
                                                        className="gap-2 text-muted-foreground"
                                                        onClick={(e) => handleArchiveClick(e, lead)}
                                                    >
                                                        <Archive className="h-3.5 w-3.5" />
                                                        Archive Lead
                                                    </DropdownMenuItem>
                                                ) : (
                                                    <DropdownMenuItem
                                                        className="gap-2 text-muted-foreground"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setAction({ kind: "restore", lead });
                                                        }}
                                                    >
                                                        <Archive className="h-3.5 w-3.5" />
                                                        Restore Lead
                                                    </DropdownMenuItem>
                                                )}
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem
                                                    className="gap-2 text-destructive focus:text-destructive"
                                                    onClick={(e) => handleDeleteClick(e, lead)}
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                    Delete Lead
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </Card>

            {/* Hint */}
            {!loading && filteredLeads.length > 0 && (
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
                    Click any lead row to open the AI Lead Analyzer
                </p>
            )}

            {/* Dialogs */}
            <AddLeadDialog
                open={addOpen}
                onOpenChange={setAddOpen}
                onLeadAdded={handleLeadAdded}
            />
            <ImportCsvDialog
                open={csvOpen}
                onOpenChange={setCsvOpen}
                onImported={() => fetchLeads(true)}
            />
            <LeadDrawer
                lead={selectedLead}
                open={drawerOpen}
                onOpenChange={setDrawerOpen}
                onLeadUpdated={handleLeadUpdated}
            />

            {/* Delete confirmation */}
            <ConfirmDialog
                open={action?.kind === "delete"}
                onOpenChange={(v) => !v && setAction(null)}
                title="Delete Lead"
                description="Are you sure you want to permanently delete this lead? This will also remove all associated proposals and invoices."
                confirmText="Delete"
                variant="danger"
                onConfirm={handleConfirmDelete}
            />

            {/* Archive confirmation */}
            <ConfirmDialog
                open={action?.kind === "archive"}
                onOpenChange={(v) => !v && setAction(null)}
                title="Archive Lead"
                description="This lead will be hidden from the active list but all its data and history will be preserved."
                confirmText="Archive"
                variant="warning"
                onConfirm={handleConfirmArchiveToggle}
            />

            <ConfirmDialog
                open={action?.kind === "restore"}
                onOpenChange={(v) => !v && setAction(null)}
                title="Restore Lead"
                description="This lead will be moved back to the active list and your pipeline."
                confirmText="Restore"
                variant="default"
                onConfirm={handleConfirmArchiveToggle}
            />

            {/* Won lead — has deps — block delete, offer archive */}
            <ConfirmDialog
                open={action?.kind === "won-delete-blocked"}
                onOpenChange={(v) => !v && setAction(null)}
                title="Cannot Delete Client Lead"
                description={
                    <div className="space-y-2">
                        <p>
                            This lead is a <strong>Won client</strong> with active invoices or
                            proposals. Hard-deleting it would destroy financial records.
                        </p>
                        <p className="text-sm">
                            Please void/delete those documents first, or{" "}
                            <strong>Archive this lead</strong> to hide it while keeping all
                            history intact.
                        </p>
                    </div>
                }
                confirmText="Archive Instead"
                cancelText="Cancel"
                variant="warning"
                onConfirm={handleConfirmArchiveToggle}
            />
        </div>
    );
}

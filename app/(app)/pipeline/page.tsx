"use client";

import * as React from "react";
import { toast } from "sonner";
import {
    DragDropContext,
    Droppable,
    Draggable,
    type DropResult,
    type DroppableProvided,
    type DroppableStateSnapshot,
    type DraggableProvided,
    type DraggableStateSnapshot,
} from "@hello-pangea/dnd";
import { Building2, MoreHorizontal, Trash2, Archive } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/auth-provider";
import { useLeadsStore } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PipelineDot } from "@/components/status-badges";
import { LeadDrawer } from "@/components/lead-drawer";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Tabs,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs";
import {
    PIPELINE_STAGES,
    type Lead,
    type PipelineStage,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const COLUMN_COLORS: Record<PipelineStage, string> = {
    "New Lead": "border-t-slate-400",
    Contacted: "border-t-blue-500",
    "Follow Up": "border-t-cyan-500",
    Interested: "border-t-violet-500",
    "Meeting Scheduled": "border-t-indigo-500",
    "Proposal Sent": "border-t-purple-500",
    Negotiation: "border-t-fuchsia-500",
    Won: "border-t-emerald-500",
    Lost: "border-t-rose-500",
};

export default function PipelinePage() {
    const { session } = useAuth();
    const {
        leads: globalLeads,
        loading,
        fetchLeads,
        archiveLead,
        restoreLead,
        deleteLead,
        moveLeadStage
    } = useLeadsStore();

    const [selectedLead, setSelectedLead] = React.useState<Lead | null>(null);
    const [drawerOpen, setDrawerOpen] = React.useState(false);

    type PipelineAction =
        | { kind: "delete"; lead: Lead }
        | { kind: "archive"; lead: Lead }
        | { kind: "restore"; lead: Lead }
        | { kind: "won-blocked"; lead: Lead }
        | null;
    const [pipelineAction, setPipelineAction] = React.useState<PipelineAction>(null);
    const [viewMode, setViewMode] = React.useState<"active" | "archived">("active");

    const leads = React.useMemo(() => {
        return globalLeads.filter((l: Lead) => viewMode === "archived" ? l.is_archived === true : !l.is_archived);
    }, [globalLeads, viewMode]);

    const activeCount = globalLeads.filter((l: Lead) => !l.is_archived).length;
    const archivedCount = globalLeads.filter((l: Lead) => l.is_archived === true).length;

    React.useEffect(() => {
        if (session?.user) fetchLeads();
    }, [session?.user, fetchLeads]);

    // Real-time subscription
    React.useEffect(() => {
        const channel = supabase
            .channel("pipeline-changes")
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

    const leadsByStage = React.useMemo(() => {
        const map: Record<PipelineStage, Lead[]> = {} as Record<
            PipelineStage,
            Lead[]
        >;
        PIPELINE_STAGES.forEach((s) => (map[s] = []));
        // Dedup by lead id in case the real-time subscription delivers
        // duplicate rows (e.g. concurrent INSERT + UPDATE events).
        const seen = new Set<string>();
        leads.forEach((lead) => {
            if (seen.has(lead.id)) return;
            seen.add(lead.id);
            const stage = lead.pipeline_stage ?? "New Lead";
            if (map[stage]) map[stage].push(lead);
        });
        return map;
    }, [leads]);

    const handleDragEnd = async (result: DropResult) => {
        const { draggableId, destination } = result;
        if (!destination) return;
        const newStage = destination.droppableId as PipelineStage;
        const lead = leads.find((l: Lead) => l.id === draggableId);
        if (!lead || lead.pipeline_stage === newStage) return;

        await moveLeadStage(lead, newStage);
    };

    const handleCardClick = (lead: Lead) => {
        setSelectedLead(lead);
        setDrawerOpen(true);
    };

    const handleLeadUpdated = (updated: Lead) => {
        useLeadsStore.getState().updateLeadLocally(updated.id, updated);
        setSelectedLead(updated);
    };

    const checkDependencies = async (leadId: string) => {
        const [propRes, invRes] = await Promise.all([
            supabase.from("proposals").select("id").eq("lead_id", leadId).limit(1),
            supabase.from("invoices").select("id").eq("lead_id", leadId).limit(1),
        ]);
        return (propRes.data?.length ?? 0) > 0 || (invRes.data?.length ?? 0) > 0;
    };

    const handleDeleteClick = async (e: React.MouseEvent, lead: Lead) => {
        e.stopPropagation();
        if (lead.pipeline_stage === "Won") {
            const hasDeps = await checkDependencies(lead.id);
            if (hasDeps) {
                setPipelineAction({ kind: "won-blocked", lead });
                return;
            }
        }
        setPipelineAction({ kind: "delete", lead });
    };

    const handleArchiveClick = (e: React.MouseEvent, lead: Lead) => {
        e.stopPropagation();
        setPipelineAction({ kind: "archive", lead });
    };

    const handleConfirmDelete = async () => {
        if (!pipelineAction || pipelineAction.kind !== "delete") return;
        await deleteLead(pipelineAction.lead);
        setPipelineAction(null);
    };

    const handleConfirmArchiveToggle = async () => {
        if (!pipelineAction || (pipelineAction.kind !== "archive" && pipelineAction.kind !== "won-blocked" && pipelineAction.kind !== "restore")) return;
        const lead = pipelineAction.lead;
        const isArchiving = pipelineAction.kind !== "restore";
        try {
            if (isArchiving) {
                await archiveLead(lead);
                setViewMode("active");
            } else {
                await restoreLead(lead);
                setViewMode("active");
            }
        } finally {
            setPipelineAction(null);
        }
    };

    if (loading) {
        return (
            <div className="space-y-4">
                <div className="flex gap-3 overflow-hidden">
                    {Array.from({ length: 9 }).map((_, i) => (
                        <Skeleton key={i} className="h-96 w-64 shrink-0 rounded-xl" />
                    ))}
                </div>
            </div>
        );
    }

    if (leads.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
                    <Building2 className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-base font-semibold text-foreground">
                    Your pipeline is empty
                </h3>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                    Add leads from the Leads page to see them in your kanban pipeline.
                </p>
            </div>
        );
    }

    const board = (
        <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-thin">
            {PIPELINE_STAGES.map((stage) => {
                const stageLeads = leadsByStage[stage] ?? [];
                return (
                    <div key={stage} className="flex w-72 shrink-0 flex-col">
                        {/* Column header */}
                        <div
                            className={cn(
                                "mb-2 rounded-t-lg border-t-4 border-border bg-card px-3 py-2.5",
                                COLUMN_COLORS[stage]
                            )}
                        >
                            <div className="flex items-center justify-between">
                                <h3 className="truncate text-sm font-semibold text-foreground">
                                    {stage}
                                </h3>
                                <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-muted px-1.5 text-xs font-medium text-muted-foreground">
                                    {stageLeads.length}
                                </span>
                            </div>
                        </div>

                        {/* Droppable area */}
                        <Droppable droppableId={stage}>
                            {(provided: DroppableProvided, snapshot: DroppableStateSnapshot) => (
                                <div
                                    ref={provided.innerRef}
                                    {...provided.droppableProps}
                                    className={cn(
                                        "flex min-h-[120px] flex-1 flex-col gap-2 rounded-b-lg bg-muted/30 p-2 transition-colors",
                                        snapshot.isDraggingOver &&
                                        "bg-indigo-50 dark:bg-indigo-500/10"
                                    )}
                                >
                                    {stageLeads.map((lead, index) => (
                                        <Draggable
                                            key={lead.id}
                                            draggableId={lead.id}
                                            index={index}
                                        >
                                            {(dragProvided: DraggableProvided, dragSnapshot: DraggableStateSnapshot) => (
                                                <Card
                                                    ref={dragProvided.innerRef}
                                                    {...dragProvided.draggableProps}
                                                    {...dragProvided.dragHandleProps}
                                                    onClick={() => handleCardClick(lead)}
                                                    className={cn(
                                                        "cursor-pointer p-3 transition-shadow hover:shadow-md",
                                                        dragSnapshot.isDragging &&
                                                        "shadow-lg ring-2 ring-indigo-500/30"
                                                    )}
                                                >
                                                    <div className="flex items-start justify-between gap-2">
                                                        <div
                                                            className="min-w-0 flex-1"
                                                            onClick={() => handleCardClick(lead)}
                                                        >
                                                            <p className="truncate text-sm font-semibold text-foreground">
                                                                {lead.company_name || "Unknown"}
                                                            </p>
                                                            <p className="truncate text-xs text-muted-foreground">
                                                                {lead.contact_name || "No contact"}
                                                            </p>
                                                        </div>
                                                        <div className="flex shrink-0 items-center gap-1">
                                                            <PipelineDot stage={lead.pipeline_stage} />
                                                            <DropdownMenu>
                                                                <DropdownMenuTrigger asChild>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="h-6 w-6"
                                                                        onClick={(e) => e.stopPropagation()}
                                                                    >
                                                                        <MoreHorizontal className="h-3.5 w-3.5" />
                                                                    </Button>
                                                                </DropdownMenuTrigger>
                                                                <DropdownMenuContent align="end">
                                                                    {viewMode === "active" ? (
                                                                        <DropdownMenuItem
                                                                            className="gap-2 text-muted-foreground"
                                                                            onClick={(e: React.MouseEvent) => handleArchiveClick(e, lead)}
                                                                        >
                                                                            <Archive className="h-3.5 w-3.5" />
                                                                            Archive
                                                                        </DropdownMenuItem>
                                                                    ) : (
                                                                        <DropdownMenuItem
                                                                            className="gap-2 text-muted-foreground"
                                                                            onClick={(e: React.MouseEvent) => {
                                                                                e.stopPropagation();
                                                                                setPipelineAction({ kind: "restore", lead });
                                                                            }}
                                                                        >
                                                                            <Archive className="h-3.5 w-3.5" />
                                                                            Restore
                                                                        </DropdownMenuItem>
                                                                    )}
                                                                    <DropdownMenuSeparator />
                                                                    <DropdownMenuItem
                                                                        className="gap-2 text-destructive focus:text-destructive"
                                                                        onClick={(e: React.MouseEvent) => handleDeleteClick(e, lead)}
                                                                    >
                                                                        <Trash2 className="h-3.5 w-3.5" />
                                                                        Delete
                                                                    </DropdownMenuItem>
                                                                </DropdownMenuContent>
                                                            </DropdownMenu>
                                                        </div>
                                                    </div>
                                                    {lead.industry && (
                                                        <div onClick={() => handleCardClick(lead)}>
                                                            <span className="mt-2 inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                                                                {lead.industry}
                                                            </span>
                                                        </div>
                                                    )}
                                                </Card>
                                            )}
                                        </Draggable>
                                    ))}
                                    {provided.placeholder}
                                    {stageLeads.length === 0 && (
                                        <div className="flex flex-1 items-center justify-center py-6 text-center">
                                            <span className="text-xs text-muted-foreground/60">
                                                Drop leads here
                                            </span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </Droppable>
                    </div>
                );
            })}
        </div>
    );

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center bg-card rounded-xl p-3 border shadow-sm">
                <div className="flex items-center gap-3 px-2">
                    <div className="flex h-10 w-10 min-w-10 items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-500/10">
                        <Building2 className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <h2 className="text-lg font-semibold text-foreground">Pipeline View</h2>
                </div>
                <Tabs value={viewMode} onValueChange={(v: any) => setViewMode(v)}>
                    <TabsList className="mb-0 h-9">
                        <TabsTrigger value="active" className="text-xs gap-1.5 px-3">
                            Active
                            <span className="flex h-4 items-center justify-center rounded-full bg-muted/60 px-1.5 text-[10px] font-medium text-foreground">
                                {activeCount}
                            </span>
                        </TabsTrigger>
                        <TabsTrigger value="archived" className="text-xs gap-1.5 px-3">
                            Archived
                            <span className="flex h-4 items-center justify-center rounded-full bg-muted/60 px-1.5 text-[10px] font-medium text-foreground">
                                {archivedCount}
                            </span>
                        </TabsTrigger>
                    </TabsList>
                </Tabs>
            </div>

            <DragDropContext onDragEnd={handleDragEnd}>
                {board as React.ReactNode}
            </DragDropContext>

            <LeadDrawer
                lead={selectedLead}
                open={drawerOpen}
                onOpenChange={setDrawerOpen}
                onLeadUpdated={handleLeadUpdated}
            />

            <ConfirmDialog
                open={pipelineAction?.kind === "delete"}
                onOpenChange={(v) => !v && setPipelineAction(null)}
                title="Delete Lead"
                description="Are you sure you want to permanently delete this lead?"
                confirmText="Delete"
                variant="danger"
                onConfirm={handleConfirmDelete}
            />
            <ConfirmDialog
                open={pipelineAction?.kind === "archive"}
                onOpenChange={(v) => !v && setPipelineAction(null)}
                title="Archive Lead"
                description="This lead will be hidden from the pipeline but its data will be preserved."
                confirmText="Archive"
                variant="warning"
                onConfirm={handleConfirmArchiveToggle}
            />
            {/* ← THE MISSING RESTORE DIALOG — this was the root cause of the dead button */}
            <ConfirmDialog
                open={pipelineAction?.kind === "restore"}
                onOpenChange={(v) => !v && setPipelineAction(null)}
                title="Restore Lead"
                description="This lead will be moved back to the active pipeline and will reappear in its original Kanban column."
                confirmText="Restore"
                variant="default"
                onConfirm={handleConfirmArchiveToggle}
            />
            <ConfirmDialog
                open={pipelineAction?.kind === "won-blocked"}
                onOpenChange={(v) => !v && setPipelineAction(null)}
                title="Cannot Delete Client Lead"
                description={
                    <div className="space-y-2">
                        <p>This <strong>Won client</strong> has active invoices or proposals. Please void/delete those documents first, or Archive this lead instead.</p>
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

"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import type {
    LeadStatus,
    PipelineStage,
    ProposalStatus,
    InvoiceStatus,
} from "@/lib/types";

const statusConfig = {
    Cold: "bg-slate-100 text-slate-700 dark:bg-slate-700/40 dark:text-slate-300",
    Warm: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
    Hot: "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300",
} as const;

const dotConfig = {
    Cold: "bg-slate-400",
    Warm: "bg-amber-500",
    Hot: "bg-rose-500",
} as const;

const pipelineColors: Record<PipelineStage, string> = {
    "New Lead": "bg-slate-500",
    Contacted: "bg-blue-500",
    "Follow Up": "bg-cyan-500",
    Interested: "bg-violet-500",
    "Meeting Scheduled": "bg-indigo-500",
    "Proposal Sent": "bg-purple-500",
    Negotiation: "bg-fuchsia-500",
    Won: "bg-emerald-500",
    Lost: "bg-rose-500",
};

const proposalStatusConfig = {
    Draft:
        "bg-slate-100 text-slate-700 dark:bg-slate-700/40 dark:text-slate-300",
    Sent: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300",
    Accepted:
        "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
    Rejected:
        "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300",
} as const;

const invoiceStatusConfig = {
    Paid: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
    Unpaid:
        "bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300",
    Void: "bg-slate-100 text-slate-500 dark:bg-slate-700/40 dark:text-slate-400 line-through",
} as const;

export function StatusBadge({ status }: { status: LeadStatus | null }) {
    const cls = status ? statusConfig[status] : statusConfig.Cold;
    return (
        <span
            className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
                cls
            )}
        >
            <span
                className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    status ? dotConfig[status] : dotConfig.Cold
                )}
            />
            {status ?? "—"}
        </span>
    );
}

export function PipelineBadge({ stage }: { stage: PipelineStage | null }) {
    return (
        <span
            className={cn(
                "inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-foreground"
            )}
        >
            <span
                className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    stage ? pipelineColors[stage] : "bg-slate-400"
                )}
            />
            {stage ?? "—"}
        </span>
    );
}

export function PipelineDot({ stage }: { stage: PipelineStage | null }) {
    return (
        <span
            className={cn(
                "inline-block h-2.5 w-2.5 rounded-full",
                stage ? pipelineColors[stage] : "bg-slate-400"
            )}
        />
    );
}

export function ProposalStatusBadge({
    status,
}: {
    status: ProposalStatus | null;
}) {
    const cls = status
        ? proposalStatusConfig[status]
        : proposalStatusConfig.Draft;
    return (
        <span
            className={cn(
                "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                cls
            )}
        >
            {status ?? "Draft"}
        </span>
    );
}

export function InvoiceStatusBadge({
    status,
}: {
    status: InvoiceStatus | null;
}) {
    const cls = status
        ? invoiceStatusConfig[status]
        : invoiceStatusConfig.Unpaid;
    return (
        <span
            className={cn(
                "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                cls
            )}
        >
            {status ?? "Unpaid"}
        </span>
    );
}

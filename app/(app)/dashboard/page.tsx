"use client";

import * as React from "react";
import {
    PieChart,
    Pie,
    Cell,
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
} from "recharts";
import {
    Users,
    Flame,
    TrendingUp,
    Clock,
    ArrowUpRight,
    Building2,
    DollarSign,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/auth-provider";
import { KpiCard } from "@/components/kpi-card";
import { StatusBadge } from "@/components/status-badges";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatRelativeTime } from "@/lib/format";
import type {
    Lead,
    Proposal,
    Invoice,
    LeadStatus,
    PipelineStage,
} from "@/lib/types";
import { PIPELINE_STAGES } from "@/lib/types";
import Link from "next/link";

const STATUS_COLORS: Record<LeadStatus, string> = {
    Cold: "#94a3b8",
    Warm: "#f59e0b",
    Hot: "#ef4444",
};

export default function DashboardPage() {
    const { profile, session } = useAuth();
    const [loading, setLoading] = React.useState(true);
    const [leads, setLeads] = React.useState<Lead[]>([]);
    const [proposals, setProposals] = React.useState<Proposal[]>([]);
    const [invoices, setInvoices] = React.useState<Invoice[]>([]);

    React.useEffect(() => {
        if (!session?.user) return;
        let cancelled = false;

        async function load() {
            setLoading(true);
            const [leadsRes, proposalsRes, invoicesRes] = await Promise.all([
                supabase
                    .from("leads")
                    .select("*")
                    .order("created_at", { ascending: false }),
                supabase
                    .from("proposals")
                    .select("*")
                    .order("created_at", { ascending: false }),
                supabase
                    .from("invoices")
                    .select("*")
                    .order("created_at", { ascending: false }),
            ]);

            if (cancelled) return;
            setLeads((leadsRes.data as Lead[]) ?? []);
            setProposals((proposalsRes.data as Proposal[]) ?? []);
            setInvoices((invoicesRes.data as Invoice[]) ?? []);
            setLoading(false);
        }

        load();
        return () => {
            cancelled = true;
        };
    }, [session?.user]);

    // KPIs
    const totalLeads = leads.length;
    const hotLeads = leads.filter((l) => l.status === "Hot").length;
    const projectedRevenue = proposals
        .filter((p) => p.status === "Accepted")
        .reduce((sum, p) => sum + (p.pricing ?? 0), 0);
    const pendingPayments = invoices
        .filter((i) => i.status === "Unpaid")
        .reduce((sum, i) => sum + (i.amount ?? 0), 0);

    // Chart data
    const statusData = React.useMemo(() => {
        const counts: Record<string, number> = { Cold: 0, Warm: 0, Hot: 0 };
        leads.forEach((l) => {
            if (l.status) counts[l.status]++;
        });
        return (["Cold", "Warm", "Hot"] as LeadStatus[]).map((s) => ({
            name: s,
            value: counts[s],
        }));
    }, [leads]);

    const pipelineData = React.useMemo(() => {
        const counts: Record<string, number> = {};
        PIPELINE_STAGES.forEach((s) => (counts[s] = 0));
        leads.forEach((l) => {
            if (l.pipeline_stage) counts[l.pipeline_stage]++;
        });
        return PIPELINE_STAGES.map((s) => ({
            name: s,
            count: counts[s],
        }));
    }, [leads]);

    // Recent activity = latest 5 leads
    const recentLeads = leads.slice(0, 5);

    const currency = profile?.currency ?? "USD";

    return (
        <div className="space-y-6">
            {/* Welcome header */}
            <div className="flex flex-col gap-1">
                <h2 className="text-xl font-bold text-foreground">
                    Welcome back, {profile?.agency_name || "Agency"}
                </h2>
                <p className="text-sm text-muted-foreground">
                    Here&apos;s what&apos;s happening with your agency today.
                </p>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <KpiCard
                    label="Total Leads"
                    value={totalLeads}
                    icon={Users}
                    accent="indigo"
                    loading={loading}
                />
                <KpiCard
                    label="Hot Leads"
                    value={hotLeads}
                    icon={Flame}
                    accent="rose"
                    loading={loading}
                />
                <KpiCard
                    label="Projected Revenue"
                    value={formatCurrency(projectedRevenue, currency)}
                    icon={TrendingUp}
                    accent="emerald"
                    subtitle="From accepted proposals"
                    loading={loading}
                />
                <KpiCard
                    label="Pending Payments"
                    value={formatCurrency(pendingPayments, currency)}
                    icon={Clock}
                    accent="amber"
                    subtitle="From unpaid invoices"
                    loading={loading}
                />
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {/* Pie chart */}
                <Card className="p-5">
                    <div className="mb-4 flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-foreground">
                            Lead Status Distribution
                        </h3>
                    </div>
                    {loading ? (
                        <div className="flex h-72 items-center justify-center">
                            <Skeleton className="h-64 w-64 rounded-full" />
                        </div>
                    ) : totalLeads === 0 ? (
                        <div className="flex h-72 flex-col items-center justify-center text-center">
                            <PieChart className="mb-3 h-12 w-12 text-muted-foreground/40" />
                            <p className="text-sm text-muted-foreground">
                                No leads yet to display
                            </p>
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height={288}>
                            <PieChart>
                                <Pie
                                    data={statusData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={100}
                                    paddingAngle={2}
                                    dataKey="value"
                                >
                                    {statusData.map((entry) => (
                                        <Cell
                                            key={entry.name}
                                            fill={STATUS_COLORS[entry.name as LeadStatus]}
                                        />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{
                                        background: "hsl(var(--popover))",
                                        border: "1px solid hsl(var(--border))",
                                        borderRadius: "8px",
                                        fontSize: "12px",
                                    }}
                                />
                                <Legend
                                    verticalAlign="bottom"
                                    iconType="circle"
                                    formatter={(v) => (
                                        <span className="text-xs text-muted-foreground">{v}</span>
                                    )}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    )}
                </Card>

                {/* Bar chart */}
                <Card className="p-5">
                    <div className="mb-4 flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-foreground">
                            Pipeline Stage Breakdown
                        </h3>
                    </div>
                    {loading ? (
                        <div className="space-y-3">
                            {Array.from({ length: 5 }).map((_, i) => (
                                <Skeleton key={i} className="h-6 w-full" />
                            ))}
                        </div>
                    ) : totalLeads === 0 ? (
                        <div className="flex h-72 flex-col items-center justify-center text-center">
                            <TrendingUp className="mb-3 h-12 w-12 text-muted-foreground/40" />
                            <p className="text-sm text-muted-foreground">
                                Pipeline data will appear here
                            </p>
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height={288}>
                            <BarChart
                                data={pipelineData}
                                margin={{ top: 8, right: 8, left: -20, bottom: 40 }}
                            >
                                <CartesianGrid
                                    strokeDasharray="3 3"
                                    stroke="hsl(var(--border))"
                                    vertical={false}
                                />
                                <XAxis
                                    dataKey="name"
                                    angle={-35}
                                    textAnchor="end"
                                    height={60}
                                    interval={0}
                                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                                />
                                <YAxis
                                    allowDecimals={false}
                                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                                />
                                <Tooltip
                                    contentStyle={{
                                        background: "hsl(var(--popover))",
                                        border: "1px solid hsl(var(--border))",
                                        borderRadius: "8px",
                                        fontSize: "12px",
                                    }}
                                    cursor={{ fill: "hsl(var(--accent) / 0.5)" }}
                                />
                                <Bar
                                    dataKey="count"
                                    fill="#4f46e5"
                                    radius={[4, 4, 0, 0]}
                                    name="Leads"
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </Card>
            </div>

            {/* Recent activity */}
            <Card className="p-5">
                <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-foreground">
                        Recent Activity
                    </h3>
                    <Link
                        href="/leads"
                        className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
                    >
                        View all
                        <ArrowUpRight className="h-3 w-3" />
                    </Link>
                </div>
                {loading ? (
                    <div className="space-y-3">
                        {Array.from({ length: 5 }).map((_, i) => (
                            <div key={i} className="flex items-center gap-3">
                                <Skeleton className="h-10 w-10 rounded-lg" />
                                <div className="flex-1 space-y-2">
                                    <Skeleton className="h-4 w-48" />
                                    <Skeleton className="h-3 w-32" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : recentLeads.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
                            <Building2 className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <p className="text-sm font-medium text-foreground">
                            No recent activity
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                            Add leads to start tracking your agency&apos;s activity
                        </p>
                        <Link
                            href="/leads"
                            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700"
                        >
                            <Users className="h-3.5 w-3.5" />
                            Add your first lead
                        </Link>
                    </div>
                ) : (
                    <div className="divide-y divide-border">
                        {recentLeads.map((lead) => (
                            <div
                                key={lead.id}
                                className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                            >
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-500/10">
                                    <Building2 className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-medium text-foreground">
                                        {lead.company_name || "Unknown Company"}
                                    </p>
                                    <p className="truncate text-xs text-muted-foreground">
                                        {lead.contact_name || "No contact"} ·{" "}
                                        {lead.industry || "Unknown industry"}
                                    </p>
                                </div>
                                <div className="flex shrink-0 items-center gap-3">
                                    <StatusBadge status={lead.status} />
                                    <span className="hidden text-xs text-muted-foreground sm:inline">
                                        {formatRelativeTime(lead.created_at)}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </Card>
        </div>
    );
}

"use client";

import * as React from "react";
import { toast } from "sonner";
import {
    Sparkles,
    Copy,
    Save,
    Mail,
    Send,
    Linkedin,
    Clock,
    TrendingUp,
    Loader2,
    Building2,
    Phone,
    Globe,
    StickyNote,
    AlertCircle,
    Target,
    Zap,
} from "lucide-react";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { StatusBadge, PipelineBadge } from "@/components/status-badges";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/auth-provider";
import { cn } from "@/lib/utils";
import type { Lead, LeadStatus } from "@/lib/types";
import {
    analyzeLead,
    generateEmail,
    generateLinkedInMessage,
    type LeadAnalysis,
} from "@/lib/llm";

// Fallback data used when the Groq API is unavailable or no key is set.
const FALLBACK_SERVICES: Record<
    string,
    { service: string; hours: number }[]
> = {
    "Real Estate": [
        { service: "AI lead qualification & smart property matching bot", hours: 40 },
        { service: "Automated listing description generator with photo analysis", hours: 20 },
        { service: "24/7 virtual tour scheduling assistant", hours: 30 },
    ],
    "E-commerce": [
        { service: "AI product recommendation engine & personalized search", hours: 45 },
        { service: "Automated customer support chatbot for orders & returns", hours: 50 },
        { service: "Dynamic pricing & inventory forecasting AI", hours: 35 },
    ],
    Healthcare: [
        { service: "AI-powered patient intake & symptom triage assistant", hours: 40 },
        { service: "Automated appointment scheduling & reminder system", hours: 30 },
        { service: "Medical document analysis & coding automation", hours: 45 },
    ],
    Legal: [
        { service: "AI contract review & clause risk detection", hours: 35 },
        { service: "Automated legal document drafting assistant", hours: 30 },
        { service: "Case research & precedent matching AI", hours: 25 },
    ],
    SaaS: [
        { service: "AI-driven customer onboarding & in-app guidance", hours: 40 },
        { service: "Churn prediction & automated retention campaigns", hours: 35 },
        { service: "Intelligent support ticket routing & auto-resolution", hours: 45 },
    ],
    Marketing: [
        { service: "AI content generation for blogs, ads & social posts", hours: 50 },
        { service: "Automated campaign analytics & A/B testing AI", hours: 30 },
        { service: "Smart audience segmentation & lookalike modeling", hours: 25 },
    ],
    Finance: [
        { service: "Automated financial report generation & analysis", hours: 40 },
        { service: "AI risk assessment & fraud detection system", hours: 45 },
        { service: "Portfolio performance prediction & alerting", hours: 30 },
    ],
    Hospitality: [
        { service: "AI concierge chatbot for bookings & recommendations", hours: 40 },
        { service: "Dynamic pricing & occupancy optimization AI", hours: 35 },
        { service: "Automated guest feedback analysis & response system", hours: 25 },
    ],
    Manufacturing: [
        { service: "Predictive maintenance & equipment monitoring AI", hours: 45 },
        { service: "Automated supply chain & inventory optimization", hours: 40 },
        { service: "Quality control computer vision system", hours: 35 },
    ],
    Education: [
        { service: "AI tutoring & personalized learning path generator", hours: 40 },
        { service: "Automated grading & feedback system", hours: 30 },
        { service: "Student engagement prediction & intervention AI", hours: 35 },
    ],
    Logistics: [
        { service: "AI route optimization & delivery prediction", hours: 45 },
        { service: "Automated warehouse inventory & tracking system", hours: 40 },
        { service: "Smart freight matching & pricing AI", hours: 30 },
    ],
    Other: [
        { service: "AI customer support chatbot & knowledge base", hours: 35 },
        { service: "Automated data entry & document processing", hours: 30 },
        { service: "AI-powered analytics dashboard & reporting", hours: 25 },
    ],
};

interface LeadDrawerProps {
    lead: Lead | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onLeadUpdated?: (lead: Lead) => void;
}

export function LeadDrawer({
    lead,
    open,
    onOpenChange,
    onLeadUpdated,
}: LeadDrawerProps) {
    const { profile } = useAuth();
    const [analyzing, setAnalyzing] = React.useState(false);
    const [generating, setGenerating] = React.useState(false);
    const [analysis, setAnalysis] = React.useState<LeadAnalysis | null>(null);
    const [emailDraft, setEmailDraft] = React.useState("");
    const [linkedinDraft, setLinkedinDraft] = React.useState("");
    const [activeTab, setActiveTab] = React.useState("email");
    const [usedFallback, setUsedFallback] = React.useState(false);

    // Reset state when a new lead opens.
    React.useEffect(() => {
        if (!lead) return;
        setAnalysis(null);
        setEmailDraft("");
        setLinkedinDraft("");
        setUsedFallback(false);
    }, [lead]);

    const geminiKey = profile?.gemini_key ?? null;

    // --- Fallback analysis (simulated) ---
    const getFallbackAnalysis = (leadVal: Lead): LeadAnalysis => {
        const industry = leadVal.industry ?? "Other";
        const services =
            FALLBACK_SERVICES[industry] ?? FALLBACK_SERVICES.Other;
        const totalHours = services.reduce((sum, s) => sum + s.hours, 0);
        return {
            opportunities: services.map(
                (s) => `${s.service} — could save ${s.hours} hours/month`
            ),
            painPoints: [
                "Manual repetitive tasks consuming valuable team hours",
                "Inconsistent lead response times causing lost opportunities",
            ],
            timeSaved: totalHours,
            services: services.map((s) => s.service),
            leadScore: leadVal.status ?? "Cold",
            raw: "Fallback analysis (AI service unavailable)",
        };
    };

    // --- Fallback outreach (simulated) ---
    const getFallbackEmail = (leadVal: Lead): string => {
        const company = leadVal.company_name || "your company";
        const contact = leadVal.contact_name || "there";
        const industryLower = (leadVal.industry ?? "general").toLowerCase();
        const services =
            FALLBACK_SERVICES[leadVal.industry ?? "Other"] ?? FALLBACK_SERVICES.Other;
        const totalHours = services.reduce((sum, s) => sum + s.hours, 0);
        return (
            `Hi ${contact},\n\n` +
            `I came across ${company} and was impressed by what you're doing in the ${industryLower} space. ` +
            `I run an AI automation agency, and after looking at your workflow, I believe there are ` +
            `a few high-impact areas where AI could save your team significant time.\n\n` +
            `Based on companies in your industry, we typically help with:\n` +
            services.map((s) => `  • ${s.service}`).join("\n") +
            `\n\nOur clients in ${industryLower} see an average of ${totalHours}+ hours saved per month ` +
            `after implementing these automations.\n\n` +
            `Would you be open to a quick 15-minute call this week to explore whether any of these ` +
            `would be a good fit for ${company}?\n\n` +
            `Best regards,\n[Your Name]\n[Your Agency]`
        );
    };

    const getFallbackLinkedIn = (leadVal: Lead): string => {
        const contact = leadVal.contact_name || "there";
        const company = leadVal.company_name || "your company";
        const industryLower = (leadVal.industry ?? "general").toLowerCase();
        const services =
            FALLBACK_SERVICES[leadVal.industry ?? "Other"] ?? FALLBACK_SERVICES.Other;
        return (
            `Hi ${contact},\n\n` +
            `I noticed ${company}'s work in ${industryLower} and wanted to reach out. ` +
            `We help ${industryLower} companies automate repetitive tasks with AI — ` +
            `things like ${services[0]?.service.toLowerCase() ?? "intelligent automation"}.\n\n` +
            `Would it make sense to connect and share ideas? Happy to keep it casual.\n\n` +
            `Best,\n[Your Name]`
        );
    };

    // --- Analyze lead with Gemini ---
    const handleAnalyze = async () => {
        if (!lead) return;
        if (!geminiKey) {
            toast.error("No Groq API key found. Go to Settings → Integrations to add one.");
            return;
        }
        setAnalyzing(true);
        try {
            const result = await analyzeLead(lead, geminiKey);
            setAnalysis(result);
            setUsedFallback(false);
            toast.success("AI analysis complete");

            // Save analysis to lead notes.
            const analysisNote = `[AI Analysis — ${new Date().toLocaleString()}]\nLead Score: ${result.leadScore}\nTime Saved: ${result.timeSaved} hours/month\nOpportunities:\n${result.opportunities.map((o, i) => `  ${i + 1}. ${o}`).join("\n")}\nPain Points:\n${result.painPoints.map((p, i) => `  ${i + 1}. ${p}`).join("\n")}\nServices:\n${result.services.map((s, i) => `  ${i + 1}. ${s}`).join("\n")}`;
            const newNotes = lead.notes
                ? `${lead.notes}\n\n${analysisNote}`
                : analysisNote;
            const { data, error } = await supabase
                .from("leads")
                .update({ notes: newNotes, status: result.leadScore })
                .eq("id", lead.id)
                .select("*")
                .maybeSingle();
            if (error) {
                console.error("Failed to save analysis:", error.message);
            } else if (data && onLeadUpdated) {
                onLeadUpdated(data as Lead);
            }
        } catch (err: any) {
            const msg = err?.message || "Unknown error";
            console.error("[LeadDrawer] Groq analysis failed:", msg);
            // Show the real error so the user can diagnose — fallback silently kicks in
            toast.error(`AI analysis failed: ${msg}`);
            setAnalysis(getFallbackAnalysis(lead));
            setUsedFallback(true);
        } finally {
            setAnalyzing(false);
        }
    };

    // --- Generate outreach with Gemini ---
    const handleGenerateOutreach = async () => {
        if (!lead) return;
        if (!geminiKey) {
            toast.error("Please add your Groq API key in Settings");
            return;
        }
        setGenerating(true);

        // Ensure analysis exists first.
        let currentAnalysis = analysis;
        if (!currentAnalysis) {
            try {
                currentAnalysis = await analyzeLead(lead, geminiKey);
                setAnalysis(currentAnalysis);
                setUsedFallback(false);
            } catch (err: any) {
                const msg = err?.message || "Unknown error";
                console.error("[LeadDrawer] pre-analyze for outreach failed:", msg);
                toast.error(`AI analysis failed: ${msg}`);
                currentAnalysis = getFallbackAnalysis(lead);
                setAnalysis(currentAnalysis);
                setUsedFallback(true);
            }
        }

        try {
            if (!usedFallback && currentAnalysis.raw !== "Fallback analysis (AI service unavailable)") {
                const [email, linkedin] = await Promise.all([
                    generateEmail(lead, currentAnalysis.raw, geminiKey),
                    generateLinkedInMessage(lead, geminiKey),
                ]);
                setEmailDraft(email);
                setLinkedinDraft(linkedin);
                toast.success("Outreach generated with AI");
            } else {
                throw new Error("Using fallback");
            }
        } catch (err: any) {
            const msg = err?.message || "Unknown error";
            console.error("[LeadDrawer] Groq outreach failed:", msg);
            toast.error(`Outreach generation failed: ${msg}`);
            setEmailDraft(getFallbackEmail(lead));
            setLinkedinDraft(getFallbackLinkedIn(lead));
            setUsedFallback(true);
        } finally {
            setGenerating(false);
        }
    };

    const copyText = (text: string, label: string) => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        toast.success(`${label} copied to clipboard`);
    };

    const sendEmail = () => {
        if (!lead?.email || !emailDraft) return;
        const subject = `AI Automation for ${lead.company_name || "your company"}`;
        const body = emailDraft;
        window.location.href = `mailto:${lead.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        toast.success("Opening email client...");
    };

    const saveToNotes = async () => {
        if (!lead) return;
        const outreach = `[AI Outreach — ${new Date().toLocaleString()}]\n\nEmail:\n${emailDraft}\n\nLinkedIn:\n${linkedinDraft}`;
        const newNotes = lead.notes
            ? `${lead.notes}\n\n${outreach}`
            : outreach;
        const { data, error } = await supabase
            .from("leads")
            .update({ notes: newNotes })
            .eq("id", lead.id)
            .select("*")
            .maybeSingle();
        if (error) {
            toast.error("Failed to save notes");
            return;
        }
        toast.success("Outreach saved to lead notes");
        if (data && onLeadUpdated) onLeadUpdated(data as Lead);
    };

    if (!lead) return null;

    // Use analysis data or fallback for display.
    const displayAnalysis = analysis ?? getFallbackAnalysis(lead);
    const displayScore: LeadStatus = analysis?.leadScore ?? lead.status ?? "Cold";

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent
                side="right"
                className="w-full overflow-y-auto p-0 sm:max-w-xl scrollbar-thin"
            >
                <SheetHeader className="border-b border-border p-6">
                    <div className="flex items-start gap-3">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-500/10">
                            <Building2 className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <SheetTitle className="truncate text-lg">
                                {lead.company_name || "Unknown Company"}
                            </SheetTitle>
                            <SheetDescription className="mt-0.5">
                                {lead.contact_name || "No contact name"}
                            </SheetDescription>
                        </div>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                        <StatusBadge status={displayScore} />
                        <PipelineBadge stage={lead.pipeline_stage} />
                        {lead.industry && (
                            <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                                {lead.industry}
                            </span>
                        )}
                    </div>
                </SheetHeader>

                <div className="space-y-6 p-6">
                    {/* Contact info */}
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {lead.email && (
                            <div className="flex items-center gap-2 text-sm">
                                <Mail className="h-4 w-4 text-muted-foreground" />
                                <span className="truncate text-foreground">{lead.email}</span>
                            </div>
                        )}
                        {lead.phone && (
                            <div className="flex items-center gap-2 text-sm">
                                <Phone className="h-4 w-4 text-muted-foreground" />
                                <span className="text-foreground">{lead.phone}</span>
                            </div>
                        )}
                        {lead.website && (
                            <div className="flex items-center gap-2 text-sm">
                                <Globe className="h-4 w-4 text-muted-foreground" />
                                <span className="truncate text-foreground">{lead.website}</span>
                            </div>
                        )}
                    </div>

                    {/* AI Analysis Section */}
                    <div className="rounded-xl border border-indigo-200/50 bg-gradient-to-br from-indigo-50/50 to-blue-50/30 p-4 dark:border-indigo-500/20 dark:from-indigo-500/5 dark:to-blue-500/5">
                        <div className="mb-3 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600">
                                    <Sparkles className="h-4 w-4 text-white" />
                                </div>
                                <h3 className="text-sm font-semibold text-foreground">
                                    AI Lead Analysis
                                </h3>
                            </div>
                            <Button
                                onClick={handleAnalyze}
                                disabled={analyzing}
                                size="sm"
                                className="bg-indigo-600 hover:bg-indigo-700"
                            >
                                {analyzing ? (
                                    <>
                                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                        Analyzing…
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                                        {analysis ? "Re-analyze" : "Analyze"}
                                    </>
                                )}
                            </Button>
                        </div>

                        {/* Fallback notice */}
                        {usedFallback && (
                            <div className="mb-3 flex items-center gap-2 rounded-lg bg-amber-50 p-2.5 dark:bg-amber-500/10">
                                <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                                <span className="text-xs text-amber-700 dark:text-amber-300">
                                    Using template fallback — AI service unavailable. Add your
                                    Groq API key in Settings for real AI analysis.
                                </span>
                            </div>
                        )}

                        {/* Lead score */}
                        <div className="mb-4 flex items-center justify-between rounded-lg bg-background/60 p-3">
                            <div className="flex items-center gap-2">
                                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm font-medium text-foreground">
                                    Lead Score
                                </span>
                            </div>
                            <StatusBadge status={displayScore} />
                        </div>

                        {/* Opportunities */}
                        {displayAnalysis.opportunities.length > 0 && (
                            <div className="mb-3 space-y-2">
                                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                    <Target className="h-3 w-3" />
                                    Opportunities
                                </p>
                                {displayAnalysis.opportunities.map((opp, i) => (
                                    <div
                                        key={i}
                                        className="flex items-start gap-2 rounded-lg bg-background/60 p-2.5"
                                    >
                                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-bold text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">
                                            {i + 1}
                                        </span>
                                        <span className="text-sm text-foreground">{opp}</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Pain points */}
                        {displayAnalysis.painPoints.length > 0 && (
                            <div className="mb-3 space-y-2">
                                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                    <AlertCircle className="h-3 w-3" />
                                    Pain Points
                                </p>
                                {displayAnalysis.painPoints.map((point, i) => (
                                    <div
                                        key={i}
                                        className="flex items-start gap-2 rounded-lg bg-background/60 p-2.5"
                                    >
                                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-100 text-[10px] font-bold text-rose-700 dark:bg-rose-500/20 dark:text-rose-300">
                                            {i + 1}
                                        </span>
                                        <span className="text-sm text-foreground">{point}</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Recommended services */}
                        {displayAnalysis.services.length > 0 && (
                            <div className="mb-3 space-y-2">
                                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                    <Zap className="h-3 w-3" />
                                    Recommended AI Services
                                </p>
                                {displayAnalysis.services.map((service, i) => (
                                    <div
                                        key={i}
                                        className="flex items-start gap-2 rounded-lg bg-background/60 p-2.5"
                                    >
                                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-bold text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">
                                            {i + 1}
                                        </span>
                                        <span className="text-sm text-foreground">{service}</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Time saved */}
                        <div className="flex items-center gap-2 rounded-lg bg-background/60 p-3">
                            <Clock className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                            <span className="text-sm text-foreground">
                                Estimated time saved:{" "}
                                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                                    {displayAnalysis.timeSaved} hours/month
                                </span>
                            </span>
                        </div>
                    </div>

                    {/* Existing notes */}
                    {lead.notes && (
                        <div className="rounded-xl border border-border p-4">
                            <div className="mb-2 flex items-center gap-2">
                                <StickyNote className="h-4 w-4 text-muted-foreground" />
                                <h3 className="text-sm font-semibold text-foreground">Notes</h3>
                            </div>
                            <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                                {lead.notes}
                            </p>
                        </div>
                    )}

                    {/* Outreach Generator */}
                    <div className="rounded-xl border border-border p-4">
                        <div className="mb-3 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Sparkles className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                                <h3 className="text-sm font-semibold text-foreground">
                                    AI Outreach Generator
                                </h3>
                            </div>
                            <Button
                                onClick={handleGenerateOutreach}
                                disabled={generating}
                                size="sm"
                                variant="outline"
                            >
                                {generating ? (
                                    <>
                                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                        Generating…
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                                        Generate
                                    </>
                                )}
                            </Button>
                        </div>

                        <Tabs
                            value={activeTab}
                            onValueChange={setActiveTab}
                            className="w-full"
                        >
                            <TabsList className="grid w-full grid-cols-2">
                                <TabsTrigger value="email" className="text-xs">
                                    <Mail className="mr-1.5 h-3.5 w-3.5" />
                                    Cold Email
                                </TabsTrigger>
                                <TabsTrigger value="linkedin" className="text-xs">
                                    <Linkedin className="mr-1.5 h-3.5 w-3.5" />
                                    LinkedIn
                                </TabsTrigger>
                            </TabsList>

                            <TabsContent value="email" className="mt-3">
                                {generating ? (
                                    <div className="flex h-48 items-center justify-center rounded-lg bg-muted/50">
                                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                            <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
                                            <p className="text-xs">Generating personalized email…</p>
                                        </div>
                                    </div>
                                ) : emailDraft ? (
                                    <div className="space-y-2">
                                        <textarea
                                            readOnly
                                            value={emailDraft}
                                            className="h-56 w-full resize-none rounded-lg border border-border bg-muted/30 p-3 text-sm text-foreground scrollbar-thin focus:outline-none"
                                        />
                                        <div className="flex gap-2">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => copyText(emailDraft, "Email")}
                                                className="flex-1"
                                            >
                                                <Copy className="mr-1.5 h-3.5 w-3.5" />
                                                Copy
                                            </Button>
                                            {lead.email && (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={sendEmail}
                                                    className="flex-1"
                                                >
                                                    <Send className="mr-1.5 h-3.5 w-3.5" />
                                                    Send Email
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex h-48 flex-col items-center justify-center rounded-lg bg-muted/30 text-center">
                                        <Mail className="mb-2 h-8 w-8 text-muted-foreground/40" />
                                        <p className="text-sm text-muted-foreground">
                                            Click &quot;Generate&quot; to create a personalized cold email
                                        </p>
                                    </div>
                                )}
                            </TabsContent>

                            <TabsContent value="linkedin" className="mt-3">
                                {generating ? (
                                    <div className="flex h-48 items-center justify-center rounded-lg bg-muted/50">
                                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                            <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
                                            <p className="text-xs">Generating LinkedIn message…</p>
                                        </div>
                                    </div>
                                ) : linkedinDraft ? (
                                    <div className="space-y-2">
                                        <textarea
                                            readOnly
                                            value={linkedinDraft}
                                            className="h-40 w-full resize-none rounded-lg border border-border bg-muted/30 p-3 text-sm text-foreground scrollbar-thin focus:outline-none"
                                        />
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => copyText(linkedinDraft, "LinkedIn message")}
                                            className="w-full"
                                        >
                                            <Copy className="mr-1.5 h-3.5 w-3.5" />
                                            Copy
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="flex h-48 flex-col items-center justify-center rounded-lg bg-muted/30 text-center">
                                        <Linkedin className="mb-2 h-8 w-8 text-muted-foreground/40" />
                                        <p className="text-sm text-muted-foreground">
                                            Click &quot;Generate&quot; to create a LinkedIn connection message
                                        </p>
                                    </div>
                                )}
                            </TabsContent>
                        </Tabs>

                        {(emailDraft || linkedinDraft) && !generating && (
                            <Button
                                onClick={saveToNotes}
                                size="sm"
                                className="mt-3 w-full bg-indigo-600 hover:bg-indigo-700"
                            >
                                <Save className="mr-1.5 h-3.5 w-3.5" />
                                Save Outreach to Notes
                            </Button>
                        )}
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    );
}

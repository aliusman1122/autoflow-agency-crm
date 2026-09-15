"use client";

import * as React from "react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
    Building2,
    Palette,
    DollarSign,
    Key,
    Loader2,
    Save,
    Check,
    ExternalLink,
    FlaskConical,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { CURRENCIES, type Currency, type BrandColors } from "@/lib/types";
import { encryptGeminiKey, getMaskedGeminiKey, encryptResendKey, getMaskedResendKey } from "./actions";

const settingsSchema = z.object({
    agency_name: z.string().min(1, "Agency name is required"),
    primary_color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Invalid hex color"),
    secondary_color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Invalid hex color"),
    currency: z.enum(["USD", "EUR", "GBP", "PKR"]),
    gemini_key: z.string().optional(),
    resend_key: z.string().optional(),
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

export default function SettingsPage() {
    const { profile, refreshProfile } = useAuth();
    const [saving, setSaving] = React.useState(false);
    const [showApiKey, setShowApiKey] = React.useState(false);
    const [showResendKey, setShowResendKey] = React.useState(false);
    const [testing, setTesting] = React.useState(false);
    const [testResult, setTestResult] = React.useState<{ ok: boolean; message: string; raw?: string } | null>(null);

    const {
        register,
        handleSubmit,
        setValue,
        watch,
        reset,
        formState: { errors },
    } = useForm<SettingsFormValues>({
        resolver: zodResolver(settingsSchema),
        defaultValues: {
            agency_name: profile?.agency_name ?? "AutoFlow Agency",
            primary_color: profile?.brand_colors?.primary ?? "#4f46e5",
            secondary_color: profile?.brand_colors?.secondary ?? "#64748b",
            currency: (profile?.currency as Currency) ?? "USD",
            gemini_key: profile?.gemini_key ?? "",
            resend_key: profile?.resend_key ?? "",
        },
    });

    // Sync form when profile loads/changes.
    React.useEffect(() => {
        if (profile) {
            (async () => {
                const maskedKey = profile.gemini_key
                    ? await getMaskedGeminiKey(profile.gemini_key)
                    : "";
                const maskedResendKey = profile.resend_key
                    ? await getMaskedResendKey(profile.resend_key)
                    : "";
                reset({
                    agency_name: profile.agency_name ?? "AutoFlow Agency",
                    primary_color: profile.brand_colors?.primary ?? "#4f46e5",
                    secondary_color: profile.brand_colors?.secondary ?? "#64748b",
                    currency: (profile.currency as Currency) ?? "USD",
                    gemini_key: maskedKey,
                    resend_key: maskedResendKey,
                });
            })();
        }
    }, [profile, reset]);

    const watchPrimary = watch("primary_color");
    const watchSecondary = watch("secondary_color");
    const watchCurrency = watch("currency");

    const onSubmit = async (values: SettingsFormValues) => {
        setSaving(true);
        try {
            const brandColors: BrandColors = {
                primary: values.primary_color,
                secondary: values.secondary_color,
            };

            let finalKey = values.gemini_key || null;
            if (finalKey && !finalKey.includes("•") && !finalKey.includes("*")) {
                finalKey = (await encryptGeminiKey(finalKey)) ?? null;
            } else if (finalKey) {
                finalKey = profile!.gemini_key; // Preserve existing encrypted key
            }

            let finalResendKey = values.resend_key || null;
            if (finalResendKey && !finalResendKey.includes("•") && !finalResendKey.includes("*")) {
                finalResendKey = (await encryptResendKey(finalResendKey)) ?? null;
            } else if (finalResendKey) {
                finalResendKey = profile!.resend_key || null; // Preserve existing encrypted key
            }

            const { error } = await supabase
                .from("profiles")
                .update({
                    agency_name: values.agency_name,
                    brand_colors: brandColors,
                    currency: values.currency,
                    gemini_key: finalKey,
                    resend_key: finalResendKey,
                })
                .eq("id", profile!.id);
            if (error) throw error;
            await refreshProfile();
            toast.success("Settings saved successfully");
        } catch (err: any) {
            toast.error(err.message || "Failed to save settings");
        } finally {
            setSaving(false);
        }
    };

    const handleTestGemini = async () => {
        setTesting(true);
        setTestResult(null);
        try {
            const res = await fetch("/api/groq", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    task: "analyze",
                    prompt: "Reply with exactly: { \"test_result\": \"GROQ_TEST_OK\" }. You must respond with valid JSON only.",
                    apiKey: profile?.gemini_key ?? undefined,
                }),
            });
            const raw = await res.text();
            let parsed: any;
            try { parsed = JSON.parse(raw); } catch { parsed = null; }

            if (res.ok && parsed?.text) {
                setTestResult({ ok: true, message: `✅ Success! Model responded: "${parsed.text.slice(0, 100)}"`, raw });
            } else {
                const errMsg = parsed?.error || parsed?.details || raw.slice(0, 300);
                setTestResult({ ok: false, message: `❌ Failed (HTTP ${res.status}): ${errMsg}`, raw });
            }
        } catch (e: any) {
            setTestResult({ ok: false, message: `❌ Network error: ${e.message}`, raw: e.message });
        } finally {
            setTesting(false);
        }
    };

    if (!profile) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-2xl space-y-6">
            <div>
                <h2 className="text-lg font-semibold text-foreground">Settings</h2>
                <p className="text-sm text-muted-foreground">
                    Manage your agency profile, branding, and integrations.
                </p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                {/* Agency Profile */}
                <Card className="p-5">
                    <div className="mb-4 flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-500/10">
                            <Building2 className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <div>
                            <h3 className="text-sm font-semibold text-foreground">
                                Agency Profile
                            </h3>
                            <p className="text-xs text-muted-foreground">
                                Your agency name appears on proposals and invoices.
                            </p>
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="agency_name">Agency Name</Label>
                        <Input
                            id="agency_name"
                            placeholder="AutoFlow Agency"
                            {...register("agency_name")}
                        />
                        {errors.agency_name && (
                            <p className="text-xs text-destructive">
                                {errors.agency_name.message}
                            </p>
                        )}
                    </div>

                    <div className="mt-4 flex items-center gap-2 rounded-lg bg-muted/50 p-3">
                        <span className="text-xs text-muted-foreground">Email:</span>
                        <span className="text-xs font-medium text-foreground">
                            {profile.email}
                        </span>
                    </div>
                </Card>

                {/* Brand Colors */}
                <Card className="p-5">
                    <div className="mb-4 flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-500/10">
                            <Palette className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <div>
                            <h3 className="text-sm font-semibold text-foreground">
                                Brand Colors
                            </h3>
                            <p className="text-xs text-muted-foreground">
                                Used in generated PDFs and branding.
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <Label htmlFor="primary_color">Primary Color</Label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="color"
                                    value={watchPrimary}
                                    onChange={(e) =>
                                        setValue("primary_color", e.target.value, {
                                            shouldValidate: true,
                                        })
                                    }
                                    className="h-10 w-12 cursor-pointer rounded-md border border-border bg-transparent p-1"
                                />
                                <Input
                                    id="primary_color"
                                    value={watchPrimary}
                                    onChange={(e) =>
                                        setValue("primary_color", e.target.value, {
                                            shouldValidate: true,
                                        })
                                    }
                                    className="font-mono"
                                />
                            </div>
                            {errors.primary_color && (
                                <p className="text-xs text-destructive">
                                    {errors.primary_color.message}
                                </p>
                            )}
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="secondary_color">Secondary Color</Label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="color"
                                    value={watchSecondary}
                                    onChange={(e) =>
                                        setValue("secondary_color", e.target.value, {
                                            shouldValidate: true,
                                        })
                                    }
                                    className="h-10 w-12 cursor-pointer rounded-md border border-border bg-transparent p-1"
                                />
                                <Input
                                    id="secondary_color"
                                    value={watchSecondary}
                                    onChange={(e) =>
                                        setValue("secondary_color", e.target.value, {
                                            shouldValidate: true,
                                        })
                                    }
                                    className="font-mono"
                                />
                            </div>
                            {errors.secondary_color && (
                                <p className="text-xs text-destructive">
                                    {errors.secondary_color.message}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Preview */}
                    <div className="mt-4 flex items-center gap-3 rounded-lg border border-border p-3">
                        <span className="text-xs font-medium text-muted-foreground">
                            Preview:
                        </span>
                        <div
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-white"
                            style={{ backgroundColor: watchPrimary }}
                        >
                            <Check className="h-4 w-4" />
                        </div>
                        <div
                            className="h-8 w-8 rounded-lg"
                            style={{ backgroundColor: watchSecondary }}
                        />
                        <div
                            className="rounded-md px-3 py-1.5 text-xs font-medium text-white"
                            style={{ backgroundColor: watchPrimary }}
                        >
                            Sample Button
                        </div>
                    </div>
                </Card>

                {/* Currency */}
                <Card className="p-5">
                    <div className="mb-4 flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-500/10">
                            <DollarSign className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <div>
                            <h3 className="text-sm font-semibold text-foreground">
                                Currency
                            </h3>
                            <p className="text-xs text-muted-foreground">
                                Used for all monetary values across the CRM.
                            </p>
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <Label>Currency</Label>
                        <Select
                            value={watchCurrency}
                            onValueChange={(v) => setValue("currency", v as Currency)}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {CURRENCIES.map((c) => (
                                    <SelectItem key={c} value={c}>
                                        {c}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </Card>

                {/* Gemini API Key */}
                <Card className="p-5">
                    <div className="mb-4 flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-500/10">
                            <Key className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <div>
                            <h3 className="text-sm font-semibold text-foreground">
                                Groq API Key
                            </h3>
                            <p className="text-xs text-muted-foreground">
                                Used to power AI features with Groq AI.
                            </p>
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="gemini_key">API Key</Label>
                        <div className="relative">
                            <Input
                                id="gemini_key"
                                type={showApiKey ? "text" : "password"}
                                placeholder="gsk_..."
                                className="pr-16 font-mono"
                                {...register("gemini_key")}
                            />
                            <button
                                type="button"
                                onClick={() => setShowApiKey((s) => !s)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground hover:text-foreground"
                            >
                                {showApiKey ? "Hide" : "Show"}
                            </button>
                        </div>
                        <a
                            href="https://console.groq.com/keys"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
                        >
                            Get free Groq API key
                            <ExternalLink className="h-3 w-3" />
                        </a>
                    </div>

                    {/* Test button */}
                    <div className="mt-4 border-t border-border pt-4">
                        <div className="flex items-center gap-3">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={handleTestGemini}
                                disabled={testing || !profile?.gemini_key}
                                className="gap-1.5"
                            >
                                {testing ? (
                                    <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Testing…</>
                                ) : (
                                    <><FlaskConical className="h-3.5 w-3.5" /> Test Groq API</>
                                )}
                            </Button>
                            {!profile?.gemini_key && (
                                <span className="text-xs text-muted-foreground">Save a key first to enable the test</span>
                            )}
                        </div>

                        {testResult && (
                            <div className={`mt-3 rounded-lg border p-3 text-xs ${testResult.ok
                                ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
                                : "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
                                }`}>
                                <p className="font-medium">{testResult.message}</p>
                                {testResult.raw && (
                                    <pre className="mt-2 max-h-36 overflow-auto whitespace-pre-wrap rounded bg-background/60 p-2 font-mono text-[10px] text-muted-foreground">
                                        {testResult.raw}
                                    </pre>
                                )}
                            </div>
                        )}
                    </div>
                </Card>

                {/* Resend API Key */}
                <Card className="p-5">
                    <div className="mb-4 flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-500/10">
                            <Key className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <div>
                            <h3 className="text-sm font-semibold text-foreground">
                                Resend API Key
                            </h3>
                            <p className="text-xs text-muted-foreground">
                                Used to send proposals and invoices to clients via email.
                            </p>
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="resend_key">API Key</Label>
                        <div className="relative">
                            <Input
                                id="resend_key"
                                type={showResendKey ? "text" : "password"}
                                placeholder="re_..."
                                className="pr-16 font-mono"
                                {...register("resend_key")}
                            />
                            <button
                                type="button"
                                onClick={() => setShowResendKey((s) => !s)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground hover:text-foreground"
                            >
                                {showResendKey ? "Hide" : "Show"}
                            </button>
                        </div>
                        <a
                            href="https://resend.com/api-keys"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
                        >
                            Get Resend API key
                            <ExternalLink className="h-3 w-3" />
                        </a>
                    </div>
                </Card>

                {/* Save button */}
                <div className="flex justify-end">
                    <Button
                        type="submit"
                        disabled={saving}
                        className="bg-indigo-600 hover:bg-indigo-700"
                    >
                        {saving ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Saving…
                            </>
                        ) : (
                            <>
                                <Save className="mr-2 h-4 w-4" />
                                Save Settings
                            </>
                        )}
                    </Button>
                </div>
            </form>
        </div>
    );
}

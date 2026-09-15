"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { Menu, Loader2 } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { Sidebar } from "@/components/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { NotificationBell } from "@/components/notification-bell";

const PAGE_TITLES: Record<string, string> = {
    "/dashboard": "Dashboard",
    "/leads": "Leads",
    "/pipeline": "Pipeline",
    "/proposals": "Proposals",
    "/invoices": "Invoices",
    "/settings": "Settings",
};

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const router = useRouter();
    const { session, loading } = useAuth();
    const [collapsed, setCollapsed] = React.useState(false);
    const [mobileOpen, setMobileOpen] = React.useState(false);

    // Auth guard.
    React.useEffect(() => {
        if (!loading && !session) {
            router.replace("/auth");
        }
    }, [loading, session, router]);

    // Derive page title from pathname.
    const pageTitle = React.useMemo(() => {
        if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
        if (pathname.startsWith("/leads")) return "Leads";
        return "AutoFlow";
    }, [pathname]);

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-background">
                <div className="flex flex-col items-center gap-3 text-muted-foreground">
                    <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
                    <p className="text-sm">Loading your workspace…</p>
                </div>
            </div>
        );
    }

    if (!session) return null;

    return (
        <div className="flex min-h-screen bg-background">
            <Sidebar
                collapsed={collapsed}
                onToggle={() => setCollapsed((c) => !c)}
                mobileOpen={mobileOpen}
                onMobileClose={() => setMobileOpen(false)}
            />

            <div className="flex flex-1 flex-col overflow-hidden">
                {/* Topbar */}
                <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-md md:px-6">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 md:hidden"
                        onClick={() => setMobileOpen(true)}
                    >
                        <Menu className="h-5 w-5" />
                    </Button>

                    <h1 className="text-lg font-semibold text-foreground">
                        {pageTitle}
                    </h1>

                    <div className="ml-auto flex items-center gap-2">
                        <NotificationBell />
                        <ThemeToggle />
                    </div>
                </header>

                {/* Main content */}
                <main className="flex-1 overflow-y-auto scrollbar-thin">
                    <div className="mx-auto max-w-7xl p-4 md:p-6 lg:p-8">{children}</div>
                </main>
            </div>
        </div>
    );
}

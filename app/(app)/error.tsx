"use client";

import { useEffect } from "react";
import { Bot, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ErrorBoundary({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error("App boundary error:", error);
    }, [error]);

    return (
        <div className="flex h-[calc(100vh-4rem)] w-full flex-col items-center justify-center gap-6 p-4 text-center bg-background">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-700 shadow-lg shadow-indigo-500/20">
                <Bot className="h-8 w-8 text-white" />
            </div>

            <div className="space-y-3">
                <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center justify-center gap-2">
                    <AlertTriangle className="h-6 w-6 text-destructive" />
                    Something went wrong!
                </h2>
                <p className="text-muted-foreground max-w-md mx-auto text-sm">
                    We experienced an unexpected error while loading this page. Our team has been notified.
                </p>
            </div>

            <Button
                onClick={() => reset()}
                className="mt-2 bg-indigo-600 hover:bg-indigo-700 text-white"
                size="lg"
            >
                Try again
            </Button>
        </div>
    );
}

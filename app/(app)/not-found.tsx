import Link from "next/link";
import { Bot, FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
    return (
        <div className="flex h-[calc(100vh-4rem)] w-full flex-col items-center justify-center gap-6 p-4 text-center bg-background">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-700 shadow-lg shadow-indigo-500/20">
                <Bot className="h-8 w-8 text-white" />
            </div>

            <div className="space-y-3">
                <h2 className="text-3xl font-bold tracking-tight text-foreground flex items-center justify-center gap-2">
                    <FileQuestion className="h-8 w-8 text-indigo-500" />
                    Page not found
                </h2>
                <p className="text-muted-foreground max-w-md mx-auto">
                    We couldn&apos;t find the page you were looking for. It might have been moved or deleted.
                </p>
            </div>

            <Button asChild className="mt-2 bg-indigo-600 hover:bg-indigo-700 text-white" size="lg">
                <Link href="/dashboard">Back to Dashboard</Link>
            </Button>
        </div>
    );
}

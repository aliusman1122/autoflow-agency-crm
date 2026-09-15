import { Skeleton } from "@/components/ui/skeleton";

export default function LeadsLoading() {
    return (
        <div className="space-y-6 h-full flex flex-col">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-2">
                    <Skeleton className="h-8 w-32" />
                    <Skeleton className="h-4 w-64" />
                </div>
                <Skeleton className="h-10 w-[120px]" />
            </div>

            <div className="flex items-center justify-between gap-4">
                <Skeleton className="h-10 w-full max-w-sm" />
                <Skeleton className="h-10 w-24" />
            </div>

            <div className="rounded-md border border-border">
                <div className="border-b border-border p-4">
                    <div className="flex justify-between">
                        <Skeleton className="h-6 w-24" />
                        <Skeleton className="h-6 w-32" />
                        <Skeleton className="h-6 w-24" />
                        <Skeleton className="h-6 w-24" />
                    </div>
                </div>
                <div className="divide-y divide-border">
                    {[...Array(6)].map((_, i) => (
                        <div key={i} className="flex items-center justify-between p-4">
                            <Skeleton className="h-6 w-32" />
                            <Skeleton className="h-6 w-48" />
                            <Skeleton className="h-6 w-24" />
                            <Skeleton className="h-6 w-24" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

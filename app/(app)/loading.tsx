import { Skeleton } from "@/components/ui/skeleton";

export default function AppLoading() {
    return (
        <div className="flex flex-col h-full space-y-6">
            {/* Header skeleton matching content area */}
            <div className="flex h-16 items-center justify-between border-b border-border pb-4">
                <div className="flex items-center gap-3">
                    <Skeleton className="h-6 w-32" />
                </div>
                <div className="flex items-center gap-2">
                    <Skeleton className="h-9 w-9 rounded-md" />
                </div>
            </div>

            {/* Main content skeleton */}
            <div className="flex-1 space-y-6">
                <Skeleton className="h-8 w-48 mb-6" />

                <div className="grid gap-6 md:grid-cols-3">
                    <Skeleton className="h-32 w-full rounded-xl" />
                    <Skeleton className="h-32 w-full rounded-xl" />
                    <Skeleton className="h-32 w-full rounded-xl" />
                </div>

                <Skeleton className="h-[400px] w-full rounded-xl mt-6" />
            </div>
        </div>
    );
}

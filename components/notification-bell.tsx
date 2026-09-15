"use client";

import * as React from "react";
import { formatDistanceToNow } from "date-fns";
import { Bell, Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Notification } from "@/lib/types";

export function NotificationBell() {
    const [notifications, setNotifications] = React.useState<Notification[]>([]);
    const { session } = useAuth();
    const router = useRouter();

    const fetchNotifications = React.useCallback(async () => {
        if (!session?.user?.id) return;
        const { data, error } = await supabase
            .from("notifications")
            .select("*")
            .eq("read", false)
            .order("created_at", { ascending: false })
            .limit(10);
        if (!error && data) {
            setNotifications(data as Notification[]);
        }
    }, [session?.user?.id]);

    React.useEffect(() => {
        fetchNotifications();
        const intervalId = setInterval(fetchNotifications, 60000); // refresh every min
        return () => clearInterval(intervalId);
    }, [fetchNotifications]);

    const markAsRead = async (id: string, type: string, entity_id?: string | null) => {
        // Optimistic update
        setNotifications((prev) => prev.filter((n) => n.id !== id));
        await supabase.from("notifications").update({ read: true }).eq("id", id);

        if (type === "lead" && entity_id) router.push(`/leads/${entity_id}`);
        else if (type === "proposal" && entity_id) router.push(`/proposals/${entity_id}`);
        else if (type === "invoice" && entity_id) router.push(`/invoices/${entity_id}`);
        else if (type === "lead") router.push(`/leads`);
        else if (type === "proposal") router.push(`/proposals`);
        else if (type === "invoice") router.push(`/invoices`);
    };

    const markAllAsRead = async () => {
        if (!session?.user?.id) return;
        // Optimistic update
        setNotifications([]);
        await supabase.from("notifications").update({ read: true }).eq("user_id", session.user.id);
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                    <Bell className="h-5 w-5" />
                    {notifications.length > 0 && (
                        <Badge
                            variant="destructive"
                            className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full p-0 text-[10px]"
                        >
                            {notifications.length}
                        </Badge>
                    )}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
                <div className="flex items-center justify-between px-4 py-2 font-semibold">
                    <span>Notifications</span>
                    {notifications.length > 0 && (
                        <Button variant="ghost" size="sm" onClick={markAllAsRead} className="h-auto p-1 text-xs">
                            <Check className="mr-1 h-3 w-3" /> Mark all read
                        </Button>
                    )}
                </div>
                <DropdownMenuSeparator />
                {notifications.length === 0 ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                        No new notifications
                    </div>
                ) : (
                    <div className="max-h-[300px] overflow-y-auto">
                        {notifications.map((n) => (
                            <DropdownMenuItem
                                key={n.id}
                                className="flex cursor-pointer flex-col items-start gap-1 p-3"
                                onClick={() => markAsRead(n.id, n.type, n.entity_id)}
                            >
                                <div className="flex w-full items-center justify-between gap-2">
                                    <span className="font-medium text-sm">{n.title}</span>
                                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                                        {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                                    </span>
                                </div>
                                {n.message && (
                                    <span className="line-clamp-2 text-xs text-muted-foreground">
                                        {n.message}
                                    </span>
                                )}
                            </DropdownMenuItem>
                        ))}
                    </div>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

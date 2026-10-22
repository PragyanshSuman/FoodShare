"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { apiFetch } from "@/lib/client";

/** Polls once a minute, and only while the tab is visible — no websocket server to run. */
export function NotificationBell() {
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    const load = () => {
      if (document.visibilityState !== "visible") return;
      apiFetch<{ unread: number }>("/api/v1/me").then((r) => setUnread(r.unread ?? 0)).catch(() => {});
    };
    load();
    timer = setInterval(load, 60_000);
    document.addEventListener("visibilitychange", load);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", load);
    };
  }, []);
  return (
    <Link href="/dashboard/notifications" aria-label={`Notifications (${unread} unread)`} className="relative rounded-md p-2 text-muted hover:bg-brand-50">
      <Bell size={20} />
      {unread > 0 && (
        <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-accent-500 px-1 text-[10px] font-bold text-white">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  );
}

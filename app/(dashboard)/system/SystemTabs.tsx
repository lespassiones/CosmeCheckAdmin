"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Cog, ShieldAlert } from "lucide-react";

/** Sous-navigation HORIZONTALE de la section Système. */
const TABS = [
  { href: "/system", label: "Système", icon: Cog },
  { href: "/system/security", label: "Sécurité", icon: ShieldAlert },
] as const;

export function SystemTabs() {
  const pathname = usePathname();
  return (
    <nav className="mb-6 flex gap-1 border-b border-black/[0.06]">
      {TABS.map((t) => {
        // /system doit matcher exactement (sinon il s'allume aussi sur /system/security).
        const active = t.href === "/system" ? pathname === "/system" : pathname.startsWith(t.href);
        const Icon = t.icon;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`inline-flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-[13px] font-medium transition ${
              active
                ? "border-rose-500 text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="h-4 w-4" />
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}

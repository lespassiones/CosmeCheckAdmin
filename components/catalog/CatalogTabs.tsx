"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FlaskConical, Calendar, Database, ScrollText } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/catalog/database", label: "Base (405k)", icon: Database },
  { href: "/catalog/promises", label: "Promesses", icon: ScrollText },
  { href: "/catalog/ingredients", label: "Ingrédients", icon: FlaskConical },
  { href: "/catalog/daily-picks", label: "Daily Picks", icon: Calendar },
] as const;

export function CatalogTabs() {
  const pathname = usePathname() ?? "";
  return (
    <nav aria-label="Sous-sections catalogue" className="mb-5 flex flex-wrap items-center gap-1.5">
      {TABS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-medium ring-1 transition-colors",
              active
                ? "bg-white text-foreground ring-black/[0.06] shadow-[0_4px_14px_-4px_rgba(15,23,42,0.10),inset_0_1px_0_rgba(255,255,255,0.95)]"
                : "bg-white/55 text-muted-foreground ring-black/[0.03] hover:text-foreground hover:bg-white/85",
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

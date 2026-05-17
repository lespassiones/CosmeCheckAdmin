"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Activity,
  Sparkles,
  Package,
  ShieldAlert,
  Cog,
  CreditCard,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string; icon: LucideIcon };

const NAV: NavItem[] = [
  { href: "/", label: "Vue", icon: LayoutDashboard },
  { href: "/users", label: "Users", icon: Users },
  { href: "/activity", label: "Activité", icon: Activity },
  { href: "/ai", label: "IA", icon: Sparkles },
  { href: "/catalog/products", label: "Catalog", icon: Package },
  { href: "/security", label: "Sécu", icon: ShieldAlert },
  { href: "/system", label: "Système", icon: Cog },
  { href: "/billing", label: "Abo", icon: CreditCard },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Horizontally-scrollable nav strip on mobile — keeps all 8 tabs reachable. */
export function MobileNav() {
  const pathname = usePathname() ?? "/";
  return (
    <nav
      aria-label="Navigation rapide"
      className="lg:hidden sticky top-[57px] z-20 -mx-4 mb-2 overflow-x-auto border-b border-black/[0.04] bg-background/85 px-4 py-2 backdrop-blur-xl scrollbar-thin"
    >
      <ul className="flex items-center gap-2 whitespace-nowrap">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium ring-1 transition-colors",
                  active
                    ? "bg-white text-foreground ring-black/[0.06] shadow-[0_2px_8px_-2px_rgba(15,23,42,0.10)]"
                    : "bg-white/50 text-muted-foreground ring-black/[0.03] hover:text-foreground",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

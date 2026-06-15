"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Activity,
  Sparkles,
  Package,
  Globe,
  ShieldAlert,
  Cog,
  CreditCard,
  SlidersHorizontal,
  MessageSquare,
  LogOut,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { adminSignOut } from "@/app/auth/actions";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: string;
};

const NAV: NavItem[] = [
  { href: "/", label: "Vue d'ensemble", icon: LayoutDashboard },
  { href: "/users", label: "Utilisateurs", icon: Users },
  { href: "/activity", label: "Activité", icon: Activity },
  { href: "/feedback", label: "Retours", icon: MessageSquare },
  { href: "/ai", label: "Coûts IA & Cache", icon: Sparkles },
  { href: "/catalog/database", label: "Catalogue", icon: Package },
  { href: "/catalog/web-products", label: "Produits web", icon: Globe },
  { href: "/security", label: "Sécurité", icon: ShieldAlert },
  { href: "/system", label: "Système", icon: Cog },
  { href: "/settings", label: "Paramètres", icon: SlidersHorizontal },
  { href: "/billing", label: "Abonnements", icon: CreditCard, badge: "Soon" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  // « Catalogue » reste actif sur tous ses sous-onglets (database, products,
  // promises, ingredients, daily-picks) ; « Produits web » garde son propre état.
  if (href === "/catalog/database") return pathname.startsWith("/catalog") && pathname !== "/catalog/web-products";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar({ adminEmail }: { adminEmail: string }) {
  const pathname = usePathname() ?? "/";
  return (
    <aside
      className="hidden lg:flex fixed left-0 top-0 z-40 h-screen w-64 flex-col gap-2 p-4 bg-white/55 backdrop-blur-2xl backdrop-saturate-150 ring-1 ring-white/70 shadow-[8px_0_30px_-12px_rgba(15,23,42,0.08),inset_-1px_0_0_rgba(255,255,255,0.65)]"
      aria-label="Navigation latérale"
    >
      {/* Brand */}
      <Link href="/" className="flex items-center gap-2.5 px-3 py-2 mb-1">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-rose-500 to-rose-600 text-white shadow-[0_8px_20px_-6px_rgba(244,63,94,0.5),inset_0_1px_0_rgba(255,255,255,0.4)]">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
            <path d="M9 2v6L3 18a3 3 0 0 0 3 4h12a3 3 0 0 0 3-4L15 8V2" />
            <path d="M9 2h6" />
          </svg>
        </span>
        <div className="leading-tight">
          <p className="text-[15px] font-bold tracking-tight">
            <span className="text-foreground">Cosme </span>
            <span className="text-rose-500">Check</span>
          </p>
          <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Admin</p>
        </div>
      </Link>

      {/* Nav */}
      <nav className="flex-1 flex flex-col gap-1 mt-2">
        {NAV.map(({ href, label, icon: Icon, badge }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn("sidebar-link", active && "sidebar-link-active")}
            >
              <Icon className="h-[18px] w-[18px] shrink-0" />
              <span className="flex-1">{label}</span>
              {badge && <span className="pill-amber text-[10px] uppercase">{badge}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="mt-2 border-t border-black/[0.06] pt-3">
        <div className="rounded-xl bg-white/70 px-3 py-2.5 ring-1 ring-black/[0.04]">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Connecté</p>
          <p className="mt-0.5 truncate text-[13px] font-medium">{adminEmail}</p>
        </div>
        <form action={adminSignOut}>
          <button
            type="submit"
            className="mt-2 flex w-full items-center gap-2 rounded-xl px-3.5 py-2.5 text-[13px] font-medium text-rose-700 transition-colors hover:bg-rose-50"
          >
            <LogOut className="h-[16px] w-[16px]" />
            Déconnexion
          </button>
        </form>
      </div>
    </aside>
  );
}

/**
 * Mobile shell — drawer-less, simplified. The admin is mostly desktop, but
 * we keep a compact top bar so the dashboard is still readable on phones.
 */
export function MobileTopBar({ adminEmail }: { adminEmail: string }) {
  return (
    <div className="lg:hidden sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-black/[0.04] bg-white/80 px-4 py-3 backdrop-blur-xl">
      <Link href="/" className="flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-rose-500 to-rose-600 text-white">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
            <path d="M9 2v6L3 18a3 3 0 0 0 3 4h12a3 3 0 0 0 3-4L15 8V2" />
            <path d="M9 2h6" />
          </svg>
        </span>
        <span className="text-[14px] font-bold tracking-tight">
          Cosme <span className="text-rose-500">Check</span>{" "}
          <span className="text-muted-foreground">Admin</span>
        </span>
      </Link>
      <span className="truncate text-[11px] text-muted-foreground">{adminEmail}</span>
    </div>
  );
}

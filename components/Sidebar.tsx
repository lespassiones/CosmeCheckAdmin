"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Activity,
  Sparkles,
  Package,
  Globe,
  Cog,
  CreditCard,
  Coins,
  SlidersHorizontal,
  MessageSquare,
  FlaskConical,
  Wallet,
  Bell,
  LogOut,
  Menu,
  X,
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
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/beta", label: "Bêta test", icon: FlaskConical },
  { href: "/ai", label: "Coûts IA & Cache", icon: Sparkles },
  { href: "/catalog/database", label: "Catalogue", icon: Package },
  { href: "/catalog/web-products", label: "Produits web", icon: Globe },
  { href: "/settings/credits", label: "Gestion des crédits", icon: Coins },
  { href: "/settings", label: "Paramètres", icon: SlidersHorizontal },
  { href: "/billing", label: "Abonnements", icon: CreditCard },
  { href: "/finance", label: "Finance", icon: Wallet },
  // Système + Sécurité fusionnés (sous-onglets), tout en bas.
  { href: "/system", label: "Système", icon: Cog },
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
 * Mobile shell — barre du haut avec BURGER MENU qui ouvre un drawer contenant
 * la navigation complète (mêmes items que la sidebar desktop) + email + logout.
 * Se ferme au clic sur un lien, sur le backdrop, ou au changement de route.
 */
export function MobileTopBar({ adminEmail }: { adminEmail: string }) {
  const pathname = usePathname() ?? "/";
  const [open, setOpen] = useState(false);

  // Fermer le drawer à chaque navigation.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <>
      <div className="lg:hidden sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-black/[0.04] bg-white/80 px-4 py-3 backdrop-blur-xl">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Ouvrir le menu"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/70 ring-1 ring-black/[0.06]"
          >
            <Menu className="h-5 w-5" />
          </button>
          <Link href="/" className="flex min-w-0 items-center gap-2">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-rose-500 to-rose-600 text-white">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                <path d="M9 2v6L3 18a3 3 0 0 0 3 4h12a3 3 0 0 0 3-4L15 8V2" />
                <path d="M9 2h6" />
              </svg>
            </span>
            <span className="truncate text-[14px] font-bold tracking-tight">
              Cosme <span className="text-rose-500">Check</span>
            </span>
          </Link>
        </div>
        <span className="max-w-[35%] truncate text-[11px] text-muted-foreground">{adminEmail}</span>
      </div>

      {/* Drawer plein écran (mobile uniquement) */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <aside className="absolute left-0 top-0 flex h-full w-72 max-w-[85%] flex-col gap-2 overflow-y-auto bg-white p-4 shadow-2xl">
            <div className="mb-1 flex items-center justify-between px-1">
              <Link href="/" onClick={() => setOpen(false)} className="flex items-center gap-2">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-rose-500 to-rose-600 text-white">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                    <path d="M9 2v6L3 18a3 3 0 0 0 3 4h12a3 3 0 0 0 3-4L15 8V2" />
                    <path d="M9 2h6" />
                  </svg>
                </span>
                <span className="text-[15px] font-bold tracking-tight">
                  Cosme <span className="text-rose-500">Check</span>
                </span>
              </Link>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Fermer le menu"
                className="grid h-8 w-8 place-items-center rounded-lg hover:bg-black/5"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <nav className="mt-1 flex flex-1 flex-col gap-1">
              {NAV.map(({ href, label, icon: Icon, badge }) => {
                const active = isActive(pathname, href);
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setOpen(false)}
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
        </div>
      )}
    </>
  );
}

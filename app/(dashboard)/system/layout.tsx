import type { ReactNode } from "react";
import { PageHeader } from "@/components/PageHeader";
import { SystemTabs } from "./SystemTabs";

/**
 * Section « Système » fusionnée : Système (santé/cron/tables) + Sécurité
 * (erreurs/abus/audit) sous une seule entrée de sidebar, avec une sous-nav
 * HORIZONTALE (onglets). Rien n'est supprimé : la sécurité vit désormais sous
 * /system/security, et l'ancienne route /security redirige ici.
 */
export default function SystemLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <PageHeader
        title="Système"
        subtitle="Santé technique, cron, tables · sécurité & abus."
        info="Section technique : onglet Système (santé infra, cron Supabase, tailles des tables, migrations) et onglet Sécurité (erreurs runtime, abus rate-limit, journal des actions admin)."
      />
      <SystemTabs />
      {children}
    </>
  );
}

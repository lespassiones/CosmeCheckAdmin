"use client";

import { useState, useTransition } from "react";
import { Check, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { saveService } from "./actions";
import type { ExternalService } from "@/lib/queries/services";

export function ServicesTable({ services }: { services: ExternalService[] }) {
  return (
    <article className="neo-card overflow-x-auto">
      <table className="w-full min-w-[860px] text-[13px]">
        <thead className="bg-muted/60 text-[11px] uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-4 py-3 text-left font-medium">Service</th>
            <th className="px-3 py-3 text-center font-medium">App mobile</th>
            <th className="px-3 py-3 text-center font-medium">App web</th>
            <th className="px-3 py-3 text-left font-medium">Facturation</th>
            <th className="px-3 py-3 text-right font-medium">Montant €/mois</th>
            <th className="px-3 py-3 text-center font-medium">Actif</th>
            <th className="px-4 py-3 text-right font-medium">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-black/[0.05]">
          {services.map((s) => (
            <Row key={s.id} svc={s} />
          ))}
        </tbody>
      </table>
    </article>
  );
}

/** Logo (favicon officiel) du service, dérivé du domaine racine de sa console. */
function faviconFor(consoleUrl: string | null): string | null {
  if (!consoleUrl) return null;
  try {
    const host = new URL(consoleUrl).hostname;
    const parts = host.split(".");
    const root = parts.length > 2 ? parts.slice(-2).join(".") : host;
    return `https://www.google.com/s2/favicons?sz=64&domain=${root}`;
  } catch {
    return null;
  }
}

function Row({ svc }: { svc: ExternalService }) {
  const [mobile, setMobile] = useState(svc.used_mobile);
  const [web, setWeb] = useState(svc.used_web);
  const [billing, setBilling] = useState<"free" | "paid">(svc.billing);
  const [amount, setAmount] = useState<string>(
    svc.monthly_amount_eur != null ? String(svc.monthly_amount_eur) : "",
  );
  const [active, setActive] = useState(svc.active);
  const [pending, start] = useTransition();

  const willSyncFinance = billing === "paid" && active && Number(amount) > 0;
  const favicon = faviconFor(svc.console_url);

  function save() {
    start(async () => {
      const r = await saveService({
        id: svc.id,
        used_mobile: mobile,
        used_web: web,
        billing,
        monthly_amount_eur: billing === "paid" ? Number(amount) : null,
        active,
      });
      if (r.ok) {
        toast.success(
          `${svc.name} enregistré${willSyncFinance ? " · ajouté à la Finance" : ""}.`,
        );
      } else {
        toast.error(r.error);
      }
    });
  }

  return (
    <tr className={active ? "" : "opacity-50"}>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          {favicon ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={favicon}
              alt=""
              width={20}
              height={20}
              className="h-5 w-5 shrink-0 rounded-[5px] ring-1 ring-black/[0.06]"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          ) : (
            <span className="h-5 w-5 shrink-0" />
          )}
          <div className="min-w-0">
            {svc.console_url ? (
              <a
                href={svc.console_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-semibold text-violet-700 hover:underline"
                title={`Ouvrir ${svc.name}`}
              >
                {svc.name}
                <ExternalLink className="h-3 w-3 opacity-70" />
              </a>
            ) : (
              <div className="font-semibold text-foreground">{svc.name}</div>
            )}
            {svc.category && (
              <div className="text-[11px] text-muted-foreground">{svc.category}</div>
            )}
          </div>
        </div>
      </td>
      <td className="px-3 py-3 text-center">
        <input
          type="checkbox"
          checked={mobile}
          onChange={(e) => setMobile(e.target.checked)}
          className="h-4 w-4 cursor-pointer accent-violet-600"
          aria-label={`${svc.name} utilisé sur mobile`}
        />
      </td>
      <td className="px-3 py-3 text-center">
        <input
          type="checkbox"
          checked={web}
          onChange={(e) => setWeb(e.target.checked)}
          className="h-4 w-4 cursor-pointer accent-violet-600"
          aria-label={`${svc.name} utilisé sur le web`}
        />
      </td>
      <td className="px-3 py-3">
        <select
          value={billing}
          onChange={(e) => setBilling(e.target.value === "paid" ? "paid" : "free")}
          className="rounded-lg border border-black/10 bg-white px-2 py-1.5 text-[12px] outline-none focus:ring-1 focus:ring-violet-300"
        >
          <option value="free">Gratuit</option>
          <option value="paid">Payant</option>
        </select>
      </td>
      <td className="px-3 py-3 text-right">
        <input
          type="number"
          min={0}
          step="0.01"
          value={billing === "paid" ? amount : ""}
          disabled={billing !== "paid"}
          onChange={(e) => setAmount(e.target.value)}
          placeholder={billing === "paid" ? "0,00" : "—"}
          className="w-24 rounded-lg border border-black/10 bg-white px-2 py-1.5 text-right text-[12px] tabular-nums outline-none focus:ring-1 focus:ring-violet-300 disabled:bg-black/[0.03] disabled:text-muted-foreground"
        />
      </td>
      <td className="px-3 py-3 text-center">
        <input
          type="checkbox"
          checked={active}
          onChange={(e) => setActive(e.target.checked)}
          className="h-4 w-4 cursor-pointer accent-emerald-600"
          aria-label={`${svc.name} actif`}
        />
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-2">
          {willSyncFinance && <span className="pill-violet text-[10px]">→ Finance</span>}
          <button
            type="button"
            disabled={pending}
            onClick={save}
            className="inline-flex items-center gap-1 rounded-full bg-violet-600 px-3 py-1.5 text-[12px] font-semibold text-white transition hover:bg-violet-700 disabled:opacity-50"
          >
            <Check className="h-3.5 w-3.5" />
            {pending ? "…" : "Enregistrer"}
          </button>
        </div>
      </td>
    </tr>
  );
}

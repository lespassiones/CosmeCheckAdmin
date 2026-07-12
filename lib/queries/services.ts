import "server-only";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * Services externes (SaaS/outils) utilisés par l'app mobile et le web.
 * Table cosme_check.external_services. Les lignes 'paid' + actives sont liées à
 * une dépense finance_expenses (finance_expense_id) pour alimenter la Finance.
 */
export type ExternalService = {
  id: string;
  name: string;
  category: string | null;
  used_mobile: boolean;
  used_web: boolean;
  billing: "free" | "paid";
  monthly_amount_eur: number | null;
  note: string | null;
  active: boolean;
  finance_expense_id: string | null;
  console_url: string | null;
  sort_order: number;
};

export async function listExternalServices(): Promise<ExternalService[]> {
  const sb = supabaseAdmin();
  const { data } = await sb
    .schema("cosme_check")
    .from("external_services")
    .select(
      "id, name, category, used_mobile, used_web, billing, monthly_amount_eur, note, active, finance_expense_id, console_url, sort_order",
    )
    .order("sort_order", { ascending: true });
  return (data ?? []) as ExternalService[];
}

/**
 * eanWebSearch (admin) — retrouve le code-barres EAN d'un produit via le modèle
 * web-search d'OpenAI (gpt-4o-mini-search-preview). Jumeau Node de l'Edge
 * function _shared/eanWebSearch.ts côté mobile.
 *
 * Garde anti-hallucination : on n'accepte un EAN que s'il passe la clé de
 * contrôle GTIN (EAN-13 / UPC-A 12 / EAN-8) et qu'une URL source est fournie.
 */
import "server-only";

/** Valide un code-barres GTIN par sa clé de contrôle (somme pondérée 3/1). */
export function isValidGtin(code: string): boolean {
  const d = (code ?? "").replace(/\D/g, "");
  if (![8, 12, 13].includes(d.length)) return false;
  const digits = d.split("").map((c) => Number(c));
  const check = digits.pop() as number;
  let sum = 0;
  let weight = 3;
  for (let i = digits.length - 1; i >= 0; i--) {
    sum += digits[i] * weight;
    weight = weight === 3 ? 1 : 3;
  }
  const cd = (10 - (sum % 10)) % 10;
  return cd === check;
}

function extractJson(text: string): Record<string, unknown> | null {
  if (!text) return null;
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first < 0 || last <= first) return null;
  try {
    return JSON.parse(text.slice(first, last + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export type EanWebResult = { ean: string; sourceUrl: string | null };

/**
 * Cherche le code-barres EAN d'un produit cosmétique sur le web.
 * Retourne null si OPENAI_API_KEY absente, rien trouvé, ou EAN invalide.
 */
export async function findEanByWebSearch(
  brand: string | null,
  name: string | null,
  opts: { timeoutMs?: number } = {},
): Promise<EanWebResult | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  const label = `${brand ?? ""} ${name ?? ""}`.trim();
  if (label.length < 3) return null;
  const timeoutMs = opts.timeoutMs ?? 25_000;

  const system = [
    "Tu es un assistant qui retrouve le CODE-BARRES (EAN-13 / GTIN) officiel d'un produit cosmétique précis via la recherche web.",
    "",
    "RÈGLES CRITIQUES :",
    "1. Renvoie le code-barres SEULEMENT si tu le trouves sur une vraie fiche produit (site officiel, marchand, base produits). Le code doit correspondre EXACTEMENT au produit demandé (même marque, même nom, même contenance si précisée).",
    "2. N'INVENTE JAMAIS un code-barres. En cas de doute, renvoie ean null. Un faux code est bien pire que pas de code.",
    "3. Le code est une suite de 13 chiffres (parfois 8 ou 12). Donne uniquement les chiffres, sans espaces.",
    "4. Donne aussi l'URL de la source où tu as lu ce code.",
    "5. Réponds en JSON STRICT sans markdown.",
    "",
    'Format : {"ean": "3401560000000", "url": "https://…"} ou {"ean": null}',
  ].join("\n");

  const userMsg = `Produit : """${label.slice(0, 200)}"""\n\nTrouve son code-barres EAN officiel sur le web. Réponds en JSON strict.`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini-search-preview",
        web_search_options: { search_context_size: "medium" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: userMsg },
        ],
      }),
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string | null } }>;
    };
    const text = data.choices?.[0]?.message?.content ?? "";
    const parsed = extractJson(text);
    if (!parsed) return null;

    const rawEan = typeof parsed.ean === "string" ? parsed.ean.replace(/\D/g, "") : "";
    if (!rawEan || !isValidGtin(rawEan)) return null;

    const url = typeof parsed.url === "string" && parsed.url.startsWith("http")
      ? parsed.url.slice(0, 500)
      : null;
    return { ean: rawEan, sourceUrl: url };
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

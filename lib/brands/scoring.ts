/**
 * Note d'une composition, calculée EN INTERNE pour l'aperçu de l'onglet
 * « Marques » (rien n'est écrit). Copie fidèle du moteur de l'Edge Function
 * `admin-score-upsert` (analyser/parse.ts + analyser/score.ts du repo mobile,
 * déjà recopiés dans le skill moderation-produit/scripts/scorer.mts) : la note
 * affichée ici est donc celle que la publication écrira au catalogue.
 * Les étoiles suivent l'app : note plafonnée par les orange/rouge, puis
 * seuils 17 / 13 / 9 / 5.
 */

// ── parse.ts (analyser) ─────────────────────────────────────────────────────
type ParsedToken = { raw: string; normalized: string; position: number };
const STOP_WORDS = new Set(["INGREDIENTS", "INGREDIENT", "INGRÉDIENTS", "INGRÉDIENT", "INCI", "COMPOSITION", "LISTE", "INGREDIENTS:", "INCI:"]);
const DESCRIPTIVE_PREFIXES: RegExp[] = [/^CERTIFIED\s+ORGANIC\s+/, /^COLD[\s-]+PRESSED\s+/, /^EXTRA\s+VIRGIN\s+/, /^STEAM\s+DISTILLED\s+/, /^FAIR[\s-]?TRADE\s+/, /^WILD[\s-]?CRAFTED\s+/, /^REVERSE\s+OSMOSIS\s+/, /^ISSU\s+DE\s+L'AGRICULTURE\s+BIOLOGIQUE\s+/, /^ORGANIC\s+/, /^NATURAL\s+/, /^NATUREL(LE)?\s+/, /^VEGETABLE\s+/, /^VEGETAL(E)?\s+/, /^VIRGIN\s+/, /^VIERGE\s+/, /^WILD\s+/, /^SAUVAGE\s+/, /^RAW\s+/, /^FRESH\s+/, /^PURE\s+/, /^PURIFIED\s+/, /^PURIFIE(E)?\s+/, /^DISTILLED\s+/, /^DISTILLE(E)?\s+/, /^DEIONIZED\s+/, /^DEMINERALIZED\s+/, /^DEMINERALISE(E)?\s+/, /^FILTERED\s+/, /^FILTRE(E)?\s+/, /^SPRING\s+/, /^IONIZED\s+/, /^BIO\s+/];
function stripDescriptivePrefixes(upper: string): string {
  let work = upper;
  let changed = true;
  while (changed) {
    changed = false;
    for (const re of DESCRIPTIVE_PREFIXES) {
      const next = work.replace(re, "");
      if (next !== work && next.trim().length >= 4) {
        work = next.trim();
        changed = true;
        break;
      }
    }
  }
  return work;
}
const NOISE_PATTERNS: RegExp[] = [/\(F\.?I\.?L\.?\s+[A-Z0-9]+\/?\d*\)/gi, /\(\+\/?\-\)/g, /\(may contain\)/gi, /\(peut contenir\)/gi, /\([A-Z0-9. ]+\d+\/\d+\)/g, /\[\s*\+\/?\-?\s*/g, /\b(?:MAY\s+CONTAIN|PEUT\s+CONTENIR)\s*:?/gi, /\]/g, /\b(?:INGREDIENTS?|INGRÉDIENTS?|INCI|COMPOSITION)\s*:\s*/gi, /^\s*[A-Z0-9]{4,}\s*[-:]\s+/];
function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}
const PAREN_ALIAS_RE = /\(([^()]{1,60})\)/g;
function looksLikeAliasContent(inner: string): boolean {
  const trimmed = inner.trim();
  if (!trimmed) return false;
  if (/[.;:!?]/.test(trimmed)) return false;
  if (/^CI\s*\d/i.test(trimmed)) return false;
  if (/^\d/.test(trimmed)) return false;
  return /^[a-zA-ZÀ-ÿ\s/,'-]+$/.test(trimmed);
}
export function parseInciList(text: string): ParsedToken[] {
  if (!text) return [];
  let work = text;
  for (const re of NOISE_PATTERNS) work = work.replace(re, " ");
  work = work.replace(PAREN_ALIAS_RE, (_m, inner: string) => (looksLikeAliasContent(inner) ? " " : `(${inner})`));
  work = work.replace(/\([^)]{20,}\)/g, " ");
  const hasRealSeparator = /[,;\n]/.test(work);
  if (hasRealSeparator) work = work.replace(/\*+/g, " ");
  else work = work.replace(/\s*\*+\s*/g, ", ");
  work = work.replace(/(?<=[A-Za-z)])\.\s+(?=[A-Z])/g, ", ");
  work = work.replace(/\.+$/g, " ");
  work = work.replace(/\s+\/\s+/g, ", ");
  work = work.replace(/([A-Za-z][A-Za-z-]*)\/([A-Za-z][A-Za-z-]*)(?![A-Za-z0-9/-]*\s+[A-Za-z])/g, "$1, $2");
  work = work.replace(/(?<=\w)(?:\s+-+\s*|\s*-+\s+)(?=\w)/g, ", ");
  work = work.replace(/(?<=\w)\s*[•·●◆▪]\s*(?=\w)/g, ", ");
  work = work.replace(/\s*[•·●◆▪]\s*/g, ", ");
  const rawParts = work.split(/[,;\n]+/g).map((p) => p.trim()).filter((p) => p.length > 0);
  const tokens: ParsedToken[] = [];
  let position = 0;
  const seen = new Set<string>();
  for (const raw of rawParts) {
    const cleaned = raw.replace(/^[\s\-•·]+|[\s\-•·.]+$/g, "").replace(/\s{2,}/g, " ").trim();
    if (!cleaned || cleaned.length < 2 || cleaned.length > 260) continue;
    const upper = stripAccents(cleaned).toUpperCase();
    if (STOP_WORDS.has(upper)) continue;
    if (/^[\d\s\-+%]+$/.test(upper)) continue;
    const normalized = stripDescriptivePrefixes(upper);
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    tokens.push({ raw: cleaned, normalized, position: position++ });
  }
  return tokens;
}

// ── score.ts (analyser) ─────────────────────────────────────────────────────
export type ColorRating = "Vert" | "Jaune" | "Orange" | "Rouge";
type VerdictTone = "very-safe" | "safe" | "caution" | "warning" | "danger" | "high-risk" | "unknown";
const RANK: Record<ColorRating, number> = { Vert: 0, Jaune: 1, Orange: 2, Rouge: 3 };
type PastilleResult = { tone: VerdictTone; nVert: number; nJaune: number; nOrange: number; nRouge: number; nIdent: number };

export function pastilleTone(colored: { color: ColorRating | null; position: number }[], totalInci: number, gate = true): PastilleResult {
  const ident = colored
    .filter((c): c is { color: ColorRating; position: number } => c.color != null && c.color in RANK)
    .slice()
    .sort((a, b) => a.position - b.position);
  const n = ident.length;
  let nVert = 0, nJaune = 0, nOrange = 0, nRouge = 0;
  for (const { color } of ident) {
    if (color === "Vert") nVert++;
    else if (color === "Jaune") nJaune++;
    else if (color === "Orange") nOrange++;
    else if (color === "Rouge") nRouge++;
  }
  const base = { nVert, nJaune, nOrange, nRouge, nIdent: n };
  if (n === 0 || (gate && totalInci && n / totalInci < 0.5)) return { tone: "unknown", ...base };
  if (nOrange === 0 && nRouge === 0) {
    if (nJaune > nVert) return { tone: "caution", ...base };
    if (nJaune === 0) return { tone: "very-safe", ...base };
    return { tone: "safe", ...base };
  }
  const corpsMax = Math.ceil(0.6 * n);
  const zoneOf = (rank1: number) => (rank1 <= 5 ? "Tete" : rank1 <= corpsMax ? "Corps" : "Queue");
  let ceiling = 0, cntRouge = 0, cntOrange = 0, sgood = 0, stot = 0;
  ident.forEach(({ color }, i) => {
    const z = zoneOf(i + 1);
    const w = z === "Tete" ? 3 : z === "Corps" ? 2 : 1;
    stot += w;
    if (color === "Vert") sgood += w;
    else if (color === "Jaune") sgood += 0.5 * w;
    if (color === "Rouge") {
      cntRouge++;
      ceiling = Math.max(ceiling, z === "Tete" ? 3 : z === "Corps" ? 2 : 1);
    } else if (color === "Orange") {
      cntOrange++;
      ceiling = Math.max(ceiling, z === "Queue" ? 0 : 1);
    }
  });
  if (cntRouge >= 2) ceiling = Math.max(ceiling, 2);
  if (cntOrange >= 4) ceiling = Math.max(ceiling, 2);
  const ratio = stot ? sgood / stot : 0;
  const comp = ratio >= 0.8 ? 0 : ratio >= 0.55 ? 1 : ratio >= 0.32 ? 2 : 3;
  const compCapped = cntRouge === 0 ? Math.min(comp, 2) : comp;
  const final = Math.max(ceiling, compCapped);
  if (final === 3) return { tone: cntRouge >= 2 ? "high-risk" : "danger", ...base };
  if (final === 2) return { tone: "warning", ...base };
  if (final === 1) return { tone: "caution", ...base };
  return { tone: "safe", ...base };
}

const BAND: Record<Exclude<VerdictTone, "unknown">, [number, number]> = {
  "very-safe": [17.0, 3.0],
  safe: [13.0, 3.9],
  caution: [9.0, 3.9],
  warning: [5.0, 3.9],
  danger: [0.0, 4.9],
  "high-risk": [0.0, 2.0],
};
export function synthScore(p: PastilleResult): number | null {
  if (p.tone === "unknown") return null;
  const [b, w] = BAND[p.tone];
  const ratio = p.nIdent ? (p.nVert + 0.5 * p.nJaune) / p.nIdent : 0;
  return Math.round((b + w * ratio) * 100) / 100;
}
export function scoreLabel(score: number): string {
  if (score >= 17) return "Très bien";
  if (score >= 13) return "Bien";
  if (score >= 9) return "Moyen";
  return "Faible";
}

// ── Étoiles (app : lib/analysis/scoreCap.ts + qualityStars.ts) ──────────────
export type StarCount = 1 | 2 | 3 | 4 | 5;
export function applyColorCap(score: number, countOrange: number, countRouge: number): number {
  let cap = Number.POSITIVE_INFINITY;
  if (countRouge >= 2 || countOrange >= 4) cap = 8.9;
  else if (countRouge >= 1) cap = 12.9;
  return Math.min(score, cap);
}
export function starsFromScore(score: number): StarCount {
  if (score >= 17) return 5;
  if (score >= 13) return 4;
  if (score >= 9) return 3;
  if (score >= 5) return 2;
  return 1;
}
export function starsFor(score: number | null | undefined, countOrange = 0, countRouge = 0): StarCount | null {
  if (score == null || Number.isNaN(Number(score))) return null;
  return starsFromScore(applyColorCap(Number(score), countOrange ?? 0, countRouge ?? 0));
}

export const STAR_LABEL: Record<StarCount, string> = {
  5: "Composition très douce",
  4: "Composition saine",
  3: "Composition correcte",
  2: "Composition moyenne",
  1: "Composition à examiner",
};
export const STAR_COLOR: Record<StarCount, string> = {
  5: "#16A34A",
  4: "#16A34A",
  3: "#F59E0B",
  2: "#F97316",
  1: "#F43F5E",
};

/** Comparaison de deux listes INCI (casse, espaces, séparateurs). */
export function sameInci(a: string | null | undefined, b: string | null | undefined): boolean {
  const key = (s: string | null | undefined) =>
    parseInciList(s ?? "")
      .map((t) => t.normalized)
      .join("|");
  return key(a) === key(b);
}

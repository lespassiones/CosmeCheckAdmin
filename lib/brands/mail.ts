/**
 * E-mails envoyés à une marque après vérification (onglet Retours > Marques).
 * Brevo API v3, clé BREVO_API_KEY (la même que le site). Fail-open : si la clé
 * manque ou si Brevo répond mal, la décision est quand même enregistrée et
 * l'écran le dit (« mail non envoyé »).
 * Règle de style : jamais de tiret cadratin ni demi-cadratin.
 */
import "server-only";
import { STAR_COLOR, STAR_LABEL, type StarCount } from "./scoring";

export function siteUrl(): string {
  return (process.env.MAIN_SITE_URL ?? process.env.BETA_MAIN_APP_URL ?? "https://www.cosme-check.com").replace(/\/$/, "");
}

export function badgePageUrl(ean: string): string {
  return `${siteUrl()}/marques/badge?ean=${encodeURIComponent(ean)}`;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function layout(body: string): string {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#F6F7F9;font-family:Helvetica,Arial,sans-serif;color:#111111;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F6F7F9;padding:24px 12px;"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#FFFFFF;border-radius:16px;border:1px solid #ECEEF1;">
<tr><td style="padding:24px 28px 8px 28px;font-size:22px;font-weight:700;"><span style="color:#111111;">Cosme </span><span style="color:#F43F5E;">Check</span></td></tr>
<tr><td style="padding:8px 28px 28px 28px;font-size:15px;line-height:1.6;color:#1F2937;">${body}</td></tr>
</table>
<p style="max-width:600px;margin:16px auto 0 auto;font-size:12px;color:#9CA3AF;">Cosme Check, l'application qui décrypte la composition des cosmétiques. cosme-check.com</p>
</td></tr></table></body></html>`;
}

function hello(name: string | null): string {
  return `<p style="margin:0 0 14px 0;">Bonjour${name ? ` ${esc(name)}` : ""},</p>`;
}

function button(url: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0;"><tr><td style="background:#F43F5E;border-radius:999px;"><a href="${esc(url)}" style="display:inline-block;padding:13px 26px;color:#FFFFFF;font-weight:700;font-size:15px;text-decoration:none;">${esc(label)}</a></td></tr></table>`;
}

export function approvedEmail(s: {
  contactName: string | null;
  brand: string;
  productName: string;
  stars: StarCount;
  ean: string;
}): { subject: string; html: string } {
  const proud = s.stars >= 4;
  const starsTxt = `${"★".repeat(s.stars)}${"☆".repeat(5 - s.stars)}`;
  const badgeImg = `${siteUrl()}/badges/cosme-check-${s.stars}-etoiles.png`;
  const body = `${hello(s.contactName)}
<p style="margin:0 0 14px 0;">Nous avons le plaisir de vous annoncer que <strong>${esc(s.productName)}</strong> (${esc(
    s.brand,
  )}) est maintenant référencé sur Cosme Check.</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:18px 0;background:#F9FAFB;border:1px solid #ECEEF1;border-radius:14px;width:100%;"><tr><td style="padding:18px 20px;">
<div style="font-size:30px;line-height:1.2;color:${STAR_COLOR[s.stars]};letter-spacing:2px;">${starsTxt}</div>
<div style="font-size:16px;font-weight:700;margin-top:4px;">${s.stars}/5, ${esc(STAR_LABEL[s.stars].toLowerCase())}</div>
</td></tr></table>
${
  proud
    ? `<p style="margin:0 0 10px 0;">Vous pouvez afficher ce résultat sur votre site, vos fiches produits ou vos réseaux :</p>
<p style="margin:0;"><img src="${esc(badgeImg)}" width="330" alt="Noté ${s.stars} étoiles sur 5 sur Cosme Check" style="display:block;width:330px;max-width:100%;height:auto;border:0;"></p>`
    : `<p style="margin:0 0 14px 0;">Si votre formule évolue, renvoyez-nous la nouvelle composition depuis l'espace marques : la note sera recalculée.</p>`
}
${button(badgePageUrl(s.ean), proud ? "Récupérer mon badge" : "Voir la note")}
<p style="margin:0 0 14px 0;font-size:13px;color:#6B7280;">La note dépend uniquement de la composition, avec le même calcul pour tous les produits.</p>
<p style="margin:0;">Merci de votre confiance,<br>L'équipe Cosme Check</p>`;
  return { subject: `${s.productName} est référencé sur Cosme Check`, html: layout(body) };
}

export function rejectedEmail(s: { contactName: string | null; productName: string; reason: string }): {
  subject: string;
  html: string;
} {
  const body = `${hello(s.contactName)}
<p style="margin:0 0 14px 0;">Merci pour votre demande de référencement de <strong>${esc(
    s.productName,
  )}</strong>. Nous ne pouvons pas la valider en l'état :</p>
<div style="background:#FFF1F2;border:1px solid #FFE4E6;border-radius:12px;padding:14px 16px;margin:0 0 14px 0;">${esc(s.reason).replace(/\n/g, "<br>")}</div>
<p style="margin:0 0 14px 0;">Vous pouvez renvoyer le produit corrigé depuis ${esc(siteUrl())}/marques, ou simplement répondre à cet e-mail.</p>
<p style="margin:0;">Bien cordialement,<br>L'équipe Cosme Check</p>`;
  return { subject: `Votre demande de référencement : ${s.productName}`, html: layout(body) };
}

export async function sendBrandMail(to: { email: string; name: string | null }, mail: { subject: string; html: string }, tag: string): Promise<boolean> {
  const key = process.env.BREVO_API_KEY;
  if (!key) return false;
  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": key, accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify({
        sender: { name: "Cosme Check", email: "contact@cosme-check.com" },
        to: [to.name ? { email: to.email, name: to.name } : { email: to.email }],
        replyTo: { email: "contact@cosme-check.com", name: "Cosme Check" },
        subject: mail.subject,
        htmlContent: mail.html,
        tags: [tag],
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) console.warn("[brands] Brevo", res.status, (await res.text()).slice(0, 200));
    return res.ok;
  } catch (e) {
    console.warn("[brands] Brevo erreur", e);
    return false;
  }
}

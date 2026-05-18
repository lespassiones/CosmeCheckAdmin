"use server";

import { requireAdmin } from "@/lib/authGuard";

export type AiPingResult =
  | {
    ok: true;
    provider: "openai" | "mistral";
    model: string;
    latencyMs: number;
    reply: string;
  }
  | {
    ok: false;
    provider: "openai" | "mistral";
    error: string;
    latencyMs?: number;
  };

const PROMPT = "Salut, réponds";
const MAX_TOKENS = 32;
const TIMEOUT_MS = 15_000;

async function callChatCompletions(opts: {
  provider: "openai" | "mistral";
  endpoint: string;
  apiKey: string;
  model: string;
}): Promise<AiPingResult> {
  const started = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(opts.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${opts.apiKey}`,
      },
      body: JSON.stringify({
        model: opts.model,
        max_tokens: MAX_TOKENS,
        messages: [{ role: "user", content: PROMPT }],
      }),
      signal: controller.signal,
      cache: "no-store",
    });
    const latencyMs = Date.now() - started;

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return {
        ok: false,
        provider: opts.provider,
        error: `HTTP ${res.status} — ${text.slice(0, 240) || res.statusText}`,
        latencyMs,
      };
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string | null } }>;
    };
    const reply = data.choices?.[0]?.message?.content?.trim() ?? "";
    if (!reply) {
      return {
        ok: false,
        provider: opts.provider,
        error: "Réponse vide reçue de l'API.",
        latencyMs,
      };
    }
    return {
      ok: true,
      provider: opts.provider,
      model: opts.model,
      latencyMs,
      reply,
    };
  } catch (e) {
    const latencyMs = Date.now() - started;
    const msg = e instanceof Error
      ? e.name === "AbortError"
        ? `Timeout après ${TIMEOUT_MS / 1000} s`
        : e.message
      : "Erreur inconnue";
    return { ok: false, provider: opts.provider, error: msg, latencyMs };
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function pingOpenAi(): Promise<AiPingResult> {
  await requireAdmin();
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    return {
      ok: false,
      provider: "openai",
      error: "Variable OPENAI_API_KEY absente côté serveur.",
    };
  }
  return callChatCompletions({
    provider: "openai",
    endpoint: "https://api.openai.com/v1/chat/completions",
    apiKey: key,
    model: "gpt-4o-mini",
  });
}

export async function pingMistral(): Promise<AiPingResult> {
  await requireAdmin();
  const key = process.env.MISTRAL_API_KEY;
  if (!key) {
    return {
      ok: false,
      provider: "mistral",
      error: "Variable MISTRAL_API_KEY absente côté serveur.",
    };
  }
  return callChatCompletions({
    provider: "mistral",
    endpoint: "https://api.mistral.ai/v1/chat/completions",
    apiKey: key,
    model: "mistral-small-latest",
  });
}

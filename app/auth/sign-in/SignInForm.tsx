"use client";

import { useState, useTransition } from "react";
import { adminSignIn } from "../actions";

export function SignInForm() {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [showPwd, setShowPwd] = useState(false);

  return (
    <form
      action={(fd) => {
        setError(null);
        startTransition(async () => {
          const r = await adminSignIn(fd);
          if (!r.ok) setError(r.error);
        });
      }}
      className="space-y-4"
    >
      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Email</span>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          className="input-base"
        />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-muted-foreground">
          Mot de passe
        </span>
        <div className="relative">
          <input
            name="password"
            type={showPwd ? "text" : "password"}
            required
            autoComplete="current-password"
            className="input-base"
          />
          <button
            type="button"
            onClick={() => setShowPwd((s) => !s)}
            className="absolute inset-y-0 right-2 my-auto h-fit px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
            aria-label={showPwd ? "Masquer le mot de passe" : "Afficher le mot de passe"}
          >
            {showPwd ? "Masquer" : "Afficher"}
          </button>
        </div>
      </label>

      {error && (
        <p
          role="alert"
          className="rounded-xl border border-rose-200/70 bg-rose-50 px-3 py-2 text-sm text-rose-700"
        >
          {error}
        </p>
      )}

      <button type="submit" disabled={pending} className="btn-primary w-full">
        {pending ? "Connexion…" : "Se connecter"}
      </button>
    </form>
  );
}

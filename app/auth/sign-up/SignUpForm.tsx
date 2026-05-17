"use client";

import { useState, useTransition } from "react";
import { adminSignUp } from "../actions";

type Checks = { length: boolean; lower: boolean; upper: boolean; digit: boolean };

function computeChecks(pwd: string): Checks {
  return {
    length: pwd.length >= 10,
    lower: /[a-z]/.test(pwd),
    upper: /[A-Z]/.test(pwd),
    digit: /[0-9]/.test(pwd),
  };
}

export function SignUpForm() {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [showPwd, setShowPwd] = useState(false);
  const [password, setPassword] = useState("");
  const [pwdFocus, setPwdFocus] = useState(false);
  const checks = computeChecks(password);
  const showList = pwdFocus || password.length > 0;

  return (
    <form
      action={(fd) => {
        setError(null);
        startTransition(async () => {
          const r = await adminSignUp(fd);
          if (!r.ok) setError(r.error);
        });
      }}
      className="space-y-4"
    >
      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Prénom</span>
        <input name="first_name" type="text" required autoComplete="given-name" className="input-base" />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Email</span>
        <input name="email" type="email" required autoComplete="email" className="input-base" />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Mot de passe</span>
        <div className="relative">
          <input
            name="password"
            type={showPwd ? "text" : "password"}
            required
            minLength={10}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onFocus={() => setPwdFocus(true)}
            onBlur={() => setPwdFocus(false)}
            className="input-base"
          />
          <button
            type="button"
            onClick={() => setShowPwd((s) => !s)}
            aria-label={showPwd ? "Masquer" : "Afficher"}
            className="absolute inset-y-0 right-2 my-auto h-fit px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
          >
            {showPwd ? "Masquer" : "Afficher"}
          </button>
        </div>
      </label>

      {showList && (
        <ul className="space-y-1 rounded-xl bg-muted/60 px-3 py-2 text-[12px]">
          <Req ok={checks.length}>Au moins 10 caractères</Req>
          <Req ok={checks.lower}>Une minuscule (a–z)</Req>
          <Req ok={checks.upper}>Une majuscule (A–Z)</Req>
          <Req ok={checks.digit}>Un chiffre (0–9)</Req>
        </ul>
      )}

      {error && (
        <p
          role="alert"
          className="rounded-xl border border-rose-200/70 bg-rose-50 px-3 py-2 text-sm text-rose-700"
        >
          {error}
        </p>
      )}

      <button type="submit" disabled={pending} className="btn-primary w-full">
        {pending ? "Création…" : "Créer le compte admin"}
      </button>
    </form>
  );
}

function Req({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li
      className={`flex items-center gap-2 transition-colors ${
        ok ? "text-emerald-600" : "text-muted-foreground"
      }`}
    >
      <span aria-hidden className="inline-flex h-3.5 w-3.5 items-center justify-center">
        {ok ? (
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
            <path fillRule="evenodd" d="M16.704 5.296a1 1 0 010 1.414l-7.5 7.5a1 1 0 01-1.414 0l-3.5-3.5a1 1 0 111.414-1.414L8.5 12.086l6.793-6.79a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        ) : (
          <span className="h-1.5 w-1.5 rounded-full bg-current opacity-60" />
        )}
      </span>
      <span>{children}</span>
    </li>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ShieldOff, ShieldCheck, KeyRound, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  suspendUser,
  unsuspendUser,
  sendPasswordReset,
  deleteUser,
} from "../actions";
import type { UserDetail } from "@/lib/queries/users";

export function DangerActions({ user }: { user: UserDetail }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState("");

  function toggleSuspend() {
    startTransition(async () => {
      const fd = new FormData();
      fd.append("user_id", user.id);
      const r = user.suspended_at ? await unsuspendUser(fd) : await suspendUser(fd);
      if (r.ok) toast.success(user.suspended_at ? "Compte réactivé" : "Compte suspendu");
      else toast.error(r.error);
    });
  }

  function pwdReset() {
    startTransition(async () => {
      const fd = new FormData();
      fd.append("email", user.email);
      const r = await sendPasswordReset(fd);
      if (r.ok) toast.success("Email de reset envoyé.");
      else toast.error(r.error);
    });
  }

  function hardDelete() {
    if (confirmDelete !== "DELETE") {
      toast.error("Tape DELETE pour confirmer.");
      return;
    }
    startTransition(async () => {
      const fd = new FormData();
      fd.append("user_id", user.id);
      fd.append("confirm", "DELETE");
      const r = await deleteUser(fd);
      if (r.ok) {
        toast.success("Compte supprimé.");
        router.push("/users");
      } else {
        toast.error(r.error);
      }
    });
  }

  return (
    <article className="glass-card-rose p-5">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {/* Suspend / Unsuspend */}
        <button
          type="button"
          onClick={toggleSuspend}
          disabled={pending}
          className="btn-secondary justify-center disabled:opacity-50"
        >
          {user.suspended_at ? (
            <>
              <ShieldCheck className="h-4 w-4" />
              Réactiver le compte
            </>
          ) : (
            <>
              <ShieldOff className="h-4 w-4" />
              Suspendre le compte
            </>
          )}
        </button>

        {/* Password reset */}
        <button
          type="button"
          onClick={pwdReset}
          disabled={pending}
          className="btn-secondary justify-center disabled:opacity-50"
        >
          <KeyRound className="h-4 w-4" />
          Envoyer un reset password
        </button>

        {/* Hard delete trigger */}
        <details className="group">
          <summary className="btn-danger w-full cursor-pointer justify-center list-none">
            <Trash2 className="h-4 w-4" />
            Supprimer définitivement
          </summary>
          <div className="mt-3 space-y-2 rounded-2xl bg-white p-3 ring-1 ring-rose-200/60">
            <p className="text-[12px] text-rose-700">
              Cette action est <strong>irréversible</strong>. Toutes les données du
              compte seront supprimées (analyses, routine, crédits, logs).
              Tape <code className="font-mono">DELETE</code> pour confirmer.
            </p>
            <input
              type="text"
              value={confirmDelete}
              onChange={(e) => setConfirmDelete(e.target.value)}
              placeholder="DELETE"
              className="input-base !py-2 !text-[13px]"
              disabled={pending}
            />
            <button
              type="button"
              onClick={hardDelete}
              disabled={pending || confirmDelete !== "DELETE"}
              className="btn-danger w-full disabled:opacity-50"
            >
              {pending ? "Suppression…" : "Confirmer la suppression"}
            </button>
          </div>
        </details>
      </div>
    </article>
  );
}

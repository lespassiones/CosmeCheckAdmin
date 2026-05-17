"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { updatePick } from "./actions";

type PickEditorProps = {
  id: string;
  initialQuestion: string;
  initialOptions: string[];
  initialCorrectIndex: number;
  initialReveal: string | null;
  initialCategory: string | null;
};

/**
 * Inline editor for a single daily pick.
 *
 * Options live in a textarea, one per line — easier than juggling N separate
 * `<input>`s for a quiz that may have 2–6 options. The server action splits
 * on \n and validates correct_index against the resulting array length.
 */
export function PickEditor({
  id,
  initialQuestion,
  initialOptions,
  initialCorrectIndex,
  initialReveal,
  initialCategory,
}: PickEditorProps) {
  const [question, setQuestion] = useState(initialQuestion);
  const [optionsText, setOptionsText] = useState(initialOptions.join("\n"));
  const [correctIndex, setCorrectIndex] = useState(String(initialCorrectIndex));
  const [reveal, setReveal] = useState(initialReveal ?? "");
  const [category, setCategory] = useState(initialCategory ?? "");
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData();
    fd.append("pick_id", id);
    fd.append("question", question);
    fd.append("options", optionsText);
    fd.append("correct_index", correctIndex);
    fd.append("reveal", reveal);
    fd.append("category", category);

    startTransition(async () => {
      const r = await updatePick(fd);
      if (r.ok) toast.success("Pick mis à jour");
      else toast.error(r.error);
    });
  }

  const optionsCount = optionsText
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean).length;

  return (
    <form onSubmit={onSubmit} className="mt-3 grid gap-3 rounded-xl bg-muted/30 p-4">
      <div>
        <label className="mb-1 block text-[11px] uppercase tracking-wider text-muted-foreground">
          Question
        </label>
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          rows={2}
          className="input-base"
          disabled={pending}
          required
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
        <div>
          <label className="mb-1 block text-[11px] uppercase tracking-wider text-muted-foreground">
            Options · une par ligne ({optionsCount})
          </label>
          <textarea
            value={optionsText}
            onChange={(e) => setOptionsText(e.target.value)}
            rows={Math.max(3, Math.min(8, optionsCount + 1))}
            className="input-base font-mono text-[12px]"
            disabled={pending}
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] uppercase tracking-wider text-muted-foreground">
            Bonne réponse (idx)
          </label>
          <input
            type="number"
            min={0}
            max={Math.max(0, optionsCount - 1)}
            value={correctIndex}
            onChange={(e) => setCorrectIndex(e.target.value)}
            className="input-base tabular-nums"
            disabled={pending}
            required
          />
          <p className="mt-1 text-[10.5px] text-muted-foreground">
            0 = première option · max {Math.max(0, optionsCount - 1)}
          </p>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-[11px] uppercase tracking-wider text-muted-foreground">
          Reveal · explication affichée après réponse
        </label>
        <textarea
          value={reveal}
          onChange={(e) => setReveal(e.target.value)}
          rows={3}
          className="input-base"
          disabled={pending}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <div>
          <label className="mb-1 block text-[11px] uppercase tracking-wider text-muted-foreground">
            Catégorie
          </label>
          <input
            type="text"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="ex: skincare, makeup, INCI…"
            className="input-base"
            disabled={pending}
          />
        </div>
        <div className="flex items-end">
          <button type="submit" disabled={pending} className="btn-primary !py-2.5 !px-5">
            <Save className="h-3.5 w-3.5" />
            {pending ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      </div>
    </form>
  );
}

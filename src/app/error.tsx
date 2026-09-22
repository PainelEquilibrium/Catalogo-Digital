"use client";

import { copyPtBr } from "@/lib/copy/pt-br";

type ErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function ErrorPage({ reset, error: _error }: ErrorPageProps) {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-4 px-4 py-24 text-center">
      <h1 className="font-[family-name:var(--font-heading)] text-2xl text-[var(--color-text)]">
        {copyPtBr.error.title}
      </h1>
      <p className="text-[color-mix(in_srgb,var(--color-text)_75%,transparent)]">
        {copyPtBr.error.description}
      </p>
      <button
        type="button"
        onClick={() => reset()}
        className="rounded-[var(--radius)] bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-[var(--color-background)] transition-opacity hover:opacity-90"
      >
        {copyPtBr.error.retry}
      </button>
    </div>
  );
}

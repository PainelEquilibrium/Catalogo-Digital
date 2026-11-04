"use client";

import Link from "next/link";
import { copyPtBr } from "@/lib/copy/pt-br";

type ConsentBannerProps = {
  onAccept: () => void;
  onReject: () => void;
};

export function ConsentBanner({ onAccept, onReject }: ConsentBannerProps) {
  return (
    <div
      role="dialog"
      aria-describedby="consent-banner-desc"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-[color-mix(in_srgb,var(--color-text)_12%,transparent)] bg-[var(--color-background)] px-4 py-4 shadow-[0_-4px_24px_rgba(0,0,0,0.08)] sm:px-6"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <p
            id="consent-banner-desc"
            className="text-sm text-[color-mix(in_srgb,var(--color-text)_75%,transparent)]"
          >
            {copyPtBr.consent.message}{" "}
            <Link
              href="/privacidade"
              className="underline underline-offset-2 hover:text-[var(--color-primary)]"
            >
              {copyPtBr.legal.privacidade}
            </Link>
            .
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button
            type="button"
            onClick={onReject}
            className="rounded-[var(--radius)] border border-[color-mix(in_srgb,var(--color-text)_20%,transparent)] px-4 py-2 text-sm text-[var(--color-text)] transition-colors hover:bg-[color-mix(in_srgb,var(--color-text)_6%,transparent)]"
          >
            {copyPtBr.consent.reject}
          </button>
          <button
            type="button"
            onClick={onAccept}
            className="rounded-[var(--radius)] bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-[var(--color-on-primary)] transition-opacity hover:opacity-90"
          >
            {copyPtBr.consent.accept}
          </button>
        </div>
      </div>
    </div>
  );
}

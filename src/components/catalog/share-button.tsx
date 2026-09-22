"use client";

import { useCallback, useState } from "react";
import { Share2 } from "lucide-react";
import { toast } from "sonner";
import { copyPtBr } from "@/lib/copy/pt-br";
import { shareProductLink } from "@/lib/share/share-product-link";

type ShareButtonProps = {
  url: string;
  title: string;
};

export function ShareButton({ url, title }: ShareButtonProps) {
  const [busy, setBusy] = useState(false);

  const handleClick = useCallback(async () => {
    if (busy) {
      return;
    }

    setBusy(true);
    try {
      const canWebShare =
        typeof navigator !== "undefined" &&
        typeof navigator.share === "function";

      await shareProductLink(
        { url, title },
        {
          canWebShare,
          share: (data) => navigator.share(data),
          writeClipboard: (text) => navigator.clipboard.writeText(text),
          onCopied: () => toast.success(copyPtBr.share.copied),
        },
      );
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      console.error("[share] Falha ao compartilhar produto.", error);
    } finally {
      setBusy(false);
    }
  }, [busy, title, url]);

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius)] border border-[color-mix(in_srgb,var(--color-text)_18%,transparent)] bg-transparent px-5 py-2.5 text-sm font-medium text-[var(--color-text)] transition-colors hover:bg-[var(--color-surface)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)] disabled:opacity-60"
    >
      <Share2 className="size-4" aria-hidden />
      {copyPtBr.share.share}
    </button>
  );
}

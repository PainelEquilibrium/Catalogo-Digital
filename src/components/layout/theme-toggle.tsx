"use client";

import { useLayoutEffect, useState } from "react";
import { copyPtBr } from "@/lib/copy/pt-br";
import { themeStorageKey } from "@/components/layout/theme-script";

type ThemeToggleProps = {
  enabled: boolean;
};

function getResolvedMode(): "light" | "dark" {
  if (typeof document === "undefined") return "light";
  if (document.documentElement.classList.contains("dark")) return "dark";
  try {
    const stored = localStorage.getItem(themeStorageKey);
    if (stored === "dark" || stored === "light") return stored;
  } catch {
    /* ignore */
  }
  return "light";
}

export function ThemeToggle({ enabled }: ThemeToggleProps) {
  const [mode, setMode] = useState<"light" | "dark">("light");
  const [hydrated, setHydrated] = useState(false);

  useLayoutEffect(() => {
    if (!enabled) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hidratação: estado só no cliente
    setMode(getResolvedMode());
    setHydrated(true);
  }, [enabled]);

  if (!enabled) return null;

  function toggle() {
    const next = mode === "dark" ? "light" : "dark";
    const root = document.documentElement;
    if (next === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
    try {
      localStorage.setItem(themeStorageKey, next);
    } catch {
      /* ignore */
    }
    setMode(next);
  }

  const label =
    mode === "dark" ? copyPtBr.theme.toggleLight : copyPtBr.theme.toggleDark;

  return (
    <button
      type="button"
      onClick={toggle}
      className="min-h-11 shrink-0 rounded-[var(--radius)] border border-[color-mix(in_srgb,var(--color-text)_12%,transparent)] px-2.5 py-2 text-xs tracking-wide text-[var(--color-text)] transition-colors hover:bg-[color-mix(in_srgb,var(--color-primary)_8%,transparent)]"
      aria-label={hydrated ? label : undefined}
      suppressHydrationWarning
    >
      {hydrated ? label : "\u00a0"}
    </button>
  );
}

"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";

export function Toaster({ ...props }: ToasterProps) {
  return (
    <Sonner
      theme="system"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-[var(--color-surface)] group-[.toaster]:text-[var(--color-text)] group-[.toaster]:border-[color-mix(in_srgb,var(--color-text)_12%,transparent)] group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-[color-mix(in_srgb,var(--color-text)_75%,transparent)]",
          actionButton:
            "group-[.toast]:bg-[var(--color-primary)] group-[.toast]:text-[var(--color-on-primary)]",
          cancelButton:
            "group-[.toast]:bg-[var(--color-surface)] group-[.toast]:text-[var(--color-text)]",
        },
      }}
      {...props}
    />
  );
}

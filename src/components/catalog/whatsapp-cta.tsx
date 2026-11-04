"use client";

import { trackWhatsappClick } from "@/lib/analytics/events";

type WhatsappCtaProps = {
  href: string;
  label: string;
  path: string;
  slug: string;
};

export function WhatsappCta({ href, label, path, slug }: WhatsappCtaProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex min-h-11 w-full items-center justify-center rounded-[var(--radius)] bg-[var(--color-primary)] px-6 py-3 text-center text-sm font-medium text-[var(--color-on-primary)] transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)] sm:w-auto"
      onClick={() => trackWhatsappClick(path, slug)}
    >
      {label}
    </a>
  );
}

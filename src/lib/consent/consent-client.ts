"use client";

import {
  consentModeFromAnalyticsGranted,
  type ConsentModeState,
  CONSENT_MODE_DEFAULT_DENIED,
} from "@/lib/consent/consent";

type GtagFn = (
  command: "consent",
  action: "default" | "update",
  params: ConsentModeState & { wait_for_update?: number },
) => void;

function getGtag(): GtagFn | null {
  if (typeof window === "undefined") {
    return null;
  }
  const w = window as Window & { gtag?: GtagFn };
  return w.gtag ?? null;
}

export function pushConsentDefaultDenied(): void {
  const gtag = getGtag();
  if (!gtag) {
    return;
  }
  gtag("consent", "default", {
    ...CONSENT_MODE_DEFAULT_DENIED,
    wait_for_update: 500,
  });
}

export function pushConsentUpdate(analyticsGranted: boolean): void {
  const gtag = getGtag();
  if (!gtag) {
    return;
  }
  gtag("consent", "update", consentModeFromAnalyticsGranted(analyticsGranted));
}

export function ensureDataLayer(): void {
  if (typeof window === "undefined") {
    return;
  }
  window.dataLayer = window.dataLayer ?? [];
}

export function pushPageView(path: string): void {
  ensureDataLayer();
  window.dataLayer?.push({
    event: "page_view",
    page_path: path,
    page_title: typeof document !== "undefined" ? document.title : "",
  });
}

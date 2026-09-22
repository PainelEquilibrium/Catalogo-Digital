export const CONSENT_STORAGE_KEY = "catalogo-consent";

export type ConsentValue = "granted" | "denied";

export type ConsentModeState = {
  ad_storage: ConsentValue;
  analytics_storage: ConsentValue;
  ad_user_data: ConsentValue;
  ad_personalization: ConsentValue;
};

export const CONSENT_MODE_DEFAULT_DENIED: ConsentModeState = {
  ad_storage: "denied",
  analytics_storage: "denied",
  ad_user_data: "denied",
  ad_personalization: "denied",
};

export function consentModeFromAnalyticsGranted(
  analyticsGranted: boolean,
): ConsentModeState {
  const value: ConsentValue = analyticsGranted ? "granted" : "denied";
  return {
    ad_storage: value,
    analytics_storage: value,
    ad_user_data: value,
    ad_personalization: value,
  };
}

export function parseStoredConsent(raw: string | null): ConsentValue | null {
  if (raw === "granted" || raw === "denied") {
    return raw;
  }
  return null;
}

export function readConsentFromStorage(
  storage: Pick<Storage, "getItem">,
): ConsentValue | null {
  return parseStoredConsent(storage.getItem(CONSENT_STORAGE_KEY));
}

export function writeConsentToStorage(
  storage: Pick<Storage, "setItem">,
  value: ConsentValue,
): void {
  storage.setItem(CONSENT_STORAGE_KEY, value);
}

export function getPublicGtmId(): string {
  const id = process.env.NEXT_PUBLIC_GTM_ID?.trim() ?? "";
  return id;
}

export function gtmScriptSrc(gtmId: string): string {
  return `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(gtmId)}`;
}

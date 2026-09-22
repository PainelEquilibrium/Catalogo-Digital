import { describe, expect, it, vi } from "vitest";
import {
  CONSENT_MODE_DEFAULT_DENIED,
  CONSENT_STORAGE_KEY,
  consentModeFromAnalyticsGranted,
  getPublicGtmId,
  gtmScriptSrc,
  parseStoredConsent,
  readConsentFromStorage,
  writeConsentToStorage,
} from "./consent";

describe("consentModeFromAnalyticsGranted", () => {
  it("usa denied por padrão no objeto estático", () => {
    expect(CONSENT_MODE_DEFAULT_DENIED).toEqual({
      ad_storage: "denied",
      analytics_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
    });
  });

  it("mapeia Aceitar para todos granted", () => {
    expect(consentModeFromAnalyticsGranted(true)).toEqual({
      ad_storage: "granted",
      analytics_storage: "granted",
      ad_user_data: "granted",
      ad_personalization: "granted",
    });
  });

  it("mapeia Recusar para todos denied", () => {
    expect(consentModeFromAnalyticsGranted(false)).toEqual({
      ad_storage: "denied",
      analytics_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
    });
  });
});

describe("catalogo-consent storage", () => {
  it("persiste e restaura granted e denied", () => {
    const storage = new Map<string, string>();
    const api = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
    };

    writeConsentToStorage(api, "granted");
    expect(storage.get(CONSENT_STORAGE_KEY)).toBe("granted");
    expect(readConsentFromStorage(api)).toBe("granted");

    writeConsentToStorage(api, "denied");
    expect(readConsentFromStorage(api)).toBe("denied");
  });

  it("ignora valores inválidos", () => {
    expect(parseStoredConsent(null)).toBeNull();
    expect(parseStoredConsent("")).toBeNull();
    expect(parseStoredConsent("maybe")).toBeNull();
  });
});

describe("GTM id", () => {
  it("não monta URL do googletagmanager quando o id público está vazio", () => {
    vi.stubEnv("NEXT_PUBLIC_GTM_ID", "");
    expect(getPublicGtmId()).toBe("");
    expect(gtmScriptSrc("GTM-TEST")).toContain("googletagmanager.com");
    vi.unstubAllEnvs();
  });
});

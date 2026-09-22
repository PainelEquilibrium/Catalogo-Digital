import { describe, expect, it, vi } from "vitest";
import { getPublicGtmId, gtmScriptSrc } from "@/lib/consent/consent";

describe("Gtm container", () => {
  it("com NEXT_PUBLIC_GTM_ID vazio não há id para injetar script", () => {
    vi.stubEnv("NEXT_PUBLIC_GTM_ID", "   ");
    expect(getPublicGtmId()).toBe("");
    vi.unstubAllEnvs();
  });

  it("URL do script aponta para googletagmanager.com quando há id", () => {
    const url = gtmScriptSrc("GTM-ABC123");
    expect(url).toBe(
      "https://www.googletagmanager.com/gtm.js?id=GTM-ABC123",
    );
  });
});

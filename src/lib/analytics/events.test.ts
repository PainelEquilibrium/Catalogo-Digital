import { afterEach, describe, expect, it, vi } from "vitest";
import { trackWhatsappClick } from "./events";

describe("trackWhatsappClick", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("empilha whatsapp_click no dataLayer com event_id, path e slug", () => {
    const dataLayer: Record<string, unknown>[] = [];
    vi.stubGlobal("crypto", {
      randomUUID: () => "test-event-id",
    });
    vi.stubGlobal("window", { dataLayer });

    trackWhatsappClick("/produto/blusa-trico-cashmere", "blusa-trico-cashmere");

    expect(dataLayer).toHaveLength(1);
    expect(dataLayer[0]).toEqual({
      event: "whatsapp_click",
      event_id: "test-event-id",
      path: "/produto/blusa-trico-cashmere",
      slug: "blusa-trico-cashmere",
    });
  });

  it("preserva entradas anteriores do dataLayer", () => {
    const dataLayer: Record<string, unknown>[] = [{ event: "page_view" }];
    vi.stubGlobal("crypto", {
      randomUUID: () => "uuid-2",
    });
    vi.stubGlobal("window", { dataLayer });

    trackWhatsappClick("/produto/vestido", "vestido");

    expect(dataLayer).toHaveLength(2);
    expect(dataLayer[1]?.event).toBe("whatsapp_click");
  });
});

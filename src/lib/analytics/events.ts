export type WhatsappClickEvent = {
  event: "whatsapp_click";
  event_id: string;
  path: string;
  slug: string | null;
  line_count: number;
};

export type PageViewEvent = {
  event: "page_view";
  page_path: string;
  page_title: string;
};

export type DataLayerEvent = WhatsappClickEvent | PageViewEvent;

declare global {
  interface Window {
    dataLayer?: DataLayerEvent[];
  }
}

export function trackWhatsappClick(
  path: string,
  slug: string | null,
  lineCount: number,
): void {
  if (typeof window === "undefined") {
    return;
  }

  window.dataLayer = window.dataLayer ?? [];
  window.dataLayer.push({
    event: "whatsapp_click",
    event_id: crypto.randomUUID(),
    path,
    slug,
    line_count: lineCount,
  });
}

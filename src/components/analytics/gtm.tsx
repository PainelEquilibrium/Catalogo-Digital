"use client";

import Script from "next/script";
import { getPublicGtmId, gtmScriptSrc } from "@/lib/consent/consent";

type GtmProps = {
  active: boolean;
};

export function Gtm({ active }: GtmProps) {
  const gtmId = getPublicGtmId();

  if (!active || !gtmId) {
    return null;
  }

  const src = gtmScriptSrc(gtmId);

  return (
    <>
      <Script id="catalogo-gtm" src={src} strategy="afterInteractive" />
      <noscript>
        <iframe
          title="Google Tag Manager"
          src={`https://www.googletagmanager.com/ns.html?id=${gtmId}`}
          height="0"
          width="0"
          style={{ display: "none", visibility: "hidden" }}
        />
      </noscript>
    </>
  );
}

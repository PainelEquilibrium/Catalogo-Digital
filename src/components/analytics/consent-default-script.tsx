import { CONSENT_MODE_DEFAULT_DENIED } from "@/lib/consent/consent";

const consentDefaultsJson = JSON.stringify(CONSENT_MODE_DEFAULT_DENIED);

export function ConsentDefaultScript() {
  const script = `
(function () {
  try {
    window.dataLayer = window.dataLayer || [];
    function gtag(){window.dataLayer.push(arguments);}
    window.gtag = gtag;
    gtag('consent', 'default', Object.assign(${consentDefaultsJson}, { wait_for_update: 500 }));
  } catch (_) {}
})();
`.trim();

  return (
    <script
      id="catalogo-consent-defaults"
      dangerouslySetInnerHTML={{ __html: script }}
      suppressHydrationWarning
    />
  );
}

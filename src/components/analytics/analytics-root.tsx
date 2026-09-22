"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ConsentBanner } from "@/components/analytics/consent-banner";
import { Gtm } from "@/components/analytics/gtm";
import {
  readConsentFromStorage,
  writeConsentToStorage,
  type ConsentValue,
} from "@/lib/consent/consent";
import {
  pushConsentUpdate,
  pushPageView,
} from "@/lib/consent/consent-client";
import {
  parseUtmFromSearch,
  persistUtmsFirstTouch,
} from "@/lib/analytics/utm";

type ConsentPhase = "pending" | "unknown" | "resolved";

export function AnalyticsRoot() {
  const pathname = usePathname();
  const [phase, setPhase] = useState<ConsentPhase>("pending");
  const [pageViewReady, setPageViewReady] = useState(false);

  useEffect(() => {
    try {
      const fromUrl = parseUtmFromSearch(window.location.search);
      persistUtmsFirstTouch(sessionStorage, fromUrl);
    } catch {
      // storage indisponível
    }
  }, []);

  useEffect(() => {
    try {
      const stored = readConsentFromStorage(localStorage);
      if (stored) {
        pushConsentUpdate(stored === "granted");
        // eslint-disable-next-line react-hooks/set-state-in-effect -- hidratação: estado só no cliente
        setPhase("resolved");
        setPageViewReady(true);
      } else {
        setPhase("unknown");
      }
    } catch {
      setPhase("unknown");
    }
  }, []);

  const finalizeChoice = useCallback((value: ConsentValue) => {
    try {
      writeConsentToStorage(localStorage, value);
    } catch {
      // segue com a escolha na sessão
    }
    pushConsentUpdate(value === "granted");
    setPhase("resolved");
    setPageViewReady(true);
  }, []);

  const handleAccept = useCallback(() => {
    finalizeChoice("granted");
  }, [finalizeChoice]);

  const handleReject = useCallback(() => {
    finalizeChoice("denied");
  }, [finalizeChoice]);

  useEffect(() => {
    if (!pageViewReady || phase !== "resolved") {
      return;
    }
    pushPageView(pathname);
  }, [pageViewReady, phase, pathname]);

  const gtmActive = phase === "resolved";

  return (
    <>
      {phase === "unknown" && (
        <ConsentBanner onAccept={handleAccept} onReject={handleReject} />
      )}
      <Gtm active={gtmActive} />
    </>
  );
}

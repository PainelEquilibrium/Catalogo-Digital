"use client";

import React, { useCallback, useState, useSyncExternalStore } from "react";

import {
  resolveCanvasFallbackIsDark,
  resolveThemeIsDark,
  subscribeToBackgroundChanges,
  type PoweredByTheme,
} from "./css-background-contrast";

type Variant = "footer" | "login" | "menu" | "badge" | "minimal";
type Logo = "compact" | "horizontal" | "square" | "icon" | "icon2";

export type PoweredByEquilibriumProps = {
  label?: string;
  href?: string;
  variant?: Variant;
  /** `dark` = fundo escuro/logo branca; `light` = fundo claro/logo preta. */
  theme?: PoweredByTheme;
  logo?: Logo;
  targetBlank?: boolean;
  showTextFallback?: boolean;
  width?: number | string;
  height?: number | string;
  className?: string;
  style?: React.CSSProperties;
  labelStyle?: React.CSSProperties;
  imageStyle?: React.CSSProperties;
  textStyle?: React.CSSProperties;
  textOnly?: boolean;
};

export type PoweredByEquilibriumTheme = PoweredByTheme;

const ASSETS = {
  white: {
    compact:
      "https://assets.equilibriumtecnologia.com.br/powered-by/logo-white-3.v1.png",
    horizontal:
      "https://assets.equilibriumtecnologia.com.br/powered-by/logo-white-2.v1.png",
    square:
      "https://assets.equilibriumtecnologia.com.br/powered-by/logo-white-1.v1.png",
    icon: "https://assets.equilibriumtecnologia.com.br/powered-by/simbolo-white-1.v1.png",
    icon2:
      "https://assets.equilibriumtecnologia.com.br/powered-by/simbolo-white-2.v1.png",
  },
  black: {
    compact:
      "https://assets.equilibriumtecnologia.com.br/powered-by/logo-black-3.v1.png",
    horizontal:
      "https://assets.equilibriumtecnologia.com.br/powered-by/logo-black-2.v1.png",
    square:
      "https://assets.equilibriumtecnologia.com.br/powered-by/logo-black-1.v1.png",
    icon: "https://assets.equilibriumtecnologia.com.br/powered-by/simbolo-black-1.v1.png",
    icon2:
      "https://assets.equilibriumtecnologia.com.br/powered-by/simbolo-black-2.v1.png",
  },
} as const;

/**
 * Assinatura reutilizável da Equilibrium para projetos React 18+.
 * Não depende de Tailwind, CSS externo, Next/Image ou configuração de assets.
 */
export function PoweredByEquilibrium({
  label = "Powered by",
  href = "https://equilibriumtecnologia.com.br",
  variant = "footer",
  theme = "auto",
  logo = "compact",
  targetBlank = true,
  showTextFallback = true,
  width,
  height,
  className,
  style,
  labelStyle,
  imageStyle,
  textStyle,
  textOnly = false,
}: PoweredByEquilibriumProps) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const hostRef = useCallback(
    (node: HTMLDivElement | null) => setHost(node),
    [],
  );

  const subscribe = useCallback(
    (callback: () => void) => {
      if (theme !== "auto") return () => {};
      return subscribeToBackgroundChanges(callback, () =>
        getElementAndAncestors(host ?? document.documentElement),
      );
    },
    [host, theme],
  );
  const getSnapshot = useCallback(() => readIsDark(theme, host), [host, theme]);
  const getServerSnapshot = useCallback(() => theme === "dark", [theme]);
  const isDark = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  const preset = getPreset(variant);
  const source = (isDark ? ASSETS.white : ASSETS.black)[logo];
  const imageFailed = failedSource === source;
  const renderText = textOnly || (showTextFallback && imageFailed);
  const contrastColor = isDark ? "#ffffff" : "#111111";

  const containerStyle: React.CSSProperties = {
    display: "inline-flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: preset.gap,
    width,
    height,
    textAlign: "center",
    ...style,
  };
  const defaultLabelStyle: React.CSSProperties = {
    margin: 0,
    color: contrastColor,
    fontFamily: SYSTEM_FONT,
    fontSize: preset.fontSize,
    lineHeight: 1.1,
    opacity: 0.9,
    userSelect: "none",
    whiteSpace: "nowrap",
  };
  const defaultImageStyle: React.CSSProperties = {
    display: "block",
    width: "auto",
    height: preset.logoHeight,
    maxWidth: "100%",
  };
  const defaultTextStyle: React.CSSProperties = {
    margin: 0,
    color: contrastColor,
    fontFamily: SYSTEM_FONT,
    fontSize: Math.max(12, preset.fontSize),
    lineHeight: 1.1,
    opacity: 0.9,
    whiteSpace: "nowrap",
  };

  return (
    <div ref={hostRef} className={className} style={containerStyle}>
      {variant !== "minimal" && (
        <p style={{ ...defaultLabelStyle, ...labelStyle }}>{label}</p>
      )}

      <a
        href={href}
        target={targetBlank ? "_blank" : undefined}
        rel={targetBlank ? "noopener noreferrer" : undefined}
        style={{ display: "inline-flex", alignItems: "center" }}
      >
        {!textOnly && !imageFailed && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={source}
            alt={renderText ? "" : "Equilibrium Tecnologia"}
            style={{ ...defaultImageStyle, ...imageStyle }}
            loading="lazy"
            decoding="async"
            onError={() => setFailedSource(source)}
          />
        )}

        {renderText && (
          <p style={{ ...defaultTextStyle, ...textStyle }}>
            Equilibrium Tecnologia
          </p>
        )}
      </a>
    </div>
  );
}

const SYSTEM_FONT =
  'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"';

function getPreset(variant: Variant) {
  switch (variant) {
    case "login":
    case "menu":
      return { fontSize: 11, gap: 6, logoHeight: 18 };
    case "badge":
      return { fontSize: 10, gap: 6, logoHeight: 16 };
    case "minimal":
      return { fontSize: 10, gap: 0, logoHeight: 18 };
    case "footer":
    default:
      return { fontSize: 12, gap: 8, logoHeight: 22 };
  }
}

function readIsDark(theme: PoweredByTheme, host: HTMLElement | null) {
  if (theme === "dark") return true;
  if (theme === "light") return false;
  if (typeof window === "undefined") return false;

  const fallbackDark = inferCanvasDark();
  const backgrounds = getElementAndAncestors(
    host ?? document.documentElement,
  ).map((element) => getComputedStyle(element).backgroundColor);
  return resolveThemeIsDark("auto", backgrounds, fallbackDark);
}

function getElementAndAncestors(element: Element) {
  const elements: Element[] = [];
  let current: Element | null = element;

  while (current) {
    elements.push(current);
    current = current.parentElement;
  }

  return elements;
}

function inferCanvasDark() {
  const root = document.documentElement;
  const colorScheme = getComputedStyle(root).colorScheme;
  const prefersDark =
    window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ?? false;
  return resolveCanvasFallbackIsDark(colorScheme, prefersDark);
}

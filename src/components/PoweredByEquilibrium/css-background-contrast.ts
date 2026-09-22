export type PoweredByTheme = "auto" | "light" | "dark";

type RgbaColor = {
  r: number;
  g: number;
  b: number;
  a: number;
  /** Native-space Y luminance for wide-gamut colors. */
  luminance?: number;
  displayP3?: { r: number; g: number; b: number };
};

const DARK_LUMINANCE_THRESHOLD = 0.179;
const WHITE: RgbaColor = { r: 255, g: 255, b: 255, a: 1 };
const BLACK: RgbaColor = { r: 0, g: 0, b: 0, a: 1 };

/** `null` means transparent or unsupported. */
export function isCssColorDark(color: string): boolean | null {
  const parsed = parseCssColor(color);
  if (!parsed || parsed.a <= 0) return null;
  return relativeLuminance(parsed) < DARK_LUMINANCE_THRESHOLD;
}

/**
 * Resolves a stack ordered from the nearest element to the document root.
 * Translucent layers are composited over their ancestors before classification.
 */
export function resolveBackgroundIsDark(
  backgroundColors: readonly string[],
  fallbackDark: boolean,
): boolean {
  let effective = fallbackDark ? BLACK : WHITE;

  for (let index = backgroundColors.length - 1; index >= 0; index -= 1) {
    const layer = parseCssColor(backgroundColors[index]);
    if (!layer || layer.a <= 0) continue;
    effective = composite(layer, effective);
  }

  return relativeLuminance(effective) < DARK_LUMINANCE_THRESHOLD;
}

export function resolveThemeIsDark(
  theme: PoweredByTheme,
  backgroundColors: readonly string[],
  fallbackDark: boolean,
): boolean {
  if (theme === "dark") return true;
  if (theme === "light") return false;
  return resolveBackgroundIsDark(backgroundColors, fallbackDark);
}

/** Resolves the browser canvas only when author backgrounds are transparent. */
export function resolveCanvasFallbackIsDark(
  colorScheme: string,
  prefersDark: boolean,
) {
  const schemes = colorScheme.toLowerCase().split(/\s+/).filter(Boolean);
  const supportsLight = schemes.includes("light");
  const supportsDark = schemes.includes("dark");

  if (supportsDark && !supportsLight) return true;
  if (supportsLight && !supportsDark) return false;
  if (supportsLight && supportsDark) return prefersDark;
  return false;
}

/**
 * Watches the supplied background chain. During CSS motion it samples every
 * animation frame so the logo can cross from black to white at the right time.
 */
export function subscribeToBackgroundChanges(
  callback: () => void,
  elementsOrReader: readonly Element[] | (() => readonly Element[]),
) {
  if (typeof window === "undefined") return () => {};

  const readElements =
    typeof elementsOrReader === "function"
      ? elementsOrReader
      : () => elementsOrReader;

  let frame: number | null = null;
  const activeMotionTargets = new Set<EventTarget>();

  const hasRunningMotion = () =>
    readElements().some((element) =>
      element
        .getAnimations?.()
        .some((animation) => animation.playState === "running"),
    );

  const flush = () => {
    frame = null;
    callback();
    if (activeMotionTargets.size > 0 || hasRunningMotion()) schedule();
  };
  const schedule = () => {
    if (frame === null) frame = window.requestAnimationFrame(flush);
  };
  const observer =
    typeof MutationObserver === "undefined"
      ? null
      : new MutationObserver(schedule);
  const instantEvents = ["pointerover", "pointerout", "focusin", "focusout"];
  const motionStartEvents = ["transitionrun", "animationstart"];
  const motionEndEvents = [
    "transitionend",
    "transitioncancel",
    "animationend",
    "animationcancel",
  ];

  const eventRoot =
    typeof document === "undefined" ? null : document.documentElement;
  const isCurrentAncestor = (target: EventTarget | null) =>
    readElements().some((element) => element === target);
  const startMotion = (event: Event) => {
    if (!isCurrentAncestor(event.target)) return;
    if (event.target) activeMotionTargets.add(event.target);
    schedule();
  };
  const endMotion = (event: Event) => {
    if (event.target) activeMotionTargets.delete(event.target);
    schedule();
  };

  if (eventRoot) {
    observer?.observe(eventRoot, {
      attributes: true,
      childList: true,
      subtree: true,
    });
    for (const event of instantEvents)
      eventRoot.addEventListener(event, schedule, true);
    for (const event of motionStartEvents)
      eventRoot.addEventListener(event, startMotion, true);
    for (const event of motionEndEvents)
      eventRoot.addEventListener(event, endMotion, true);
  } else {
    for (const element of readElements()) {
      observer?.observe(element, { attributes: true, childList: true });
      for (const event of instantEvents)
        element.addEventListener(event, schedule);
      for (const event of motionStartEvents)
        element.addEventListener(event, startMotion);
      for (const event of motionEndEvents)
        element.addEventListener(event, endMotion);
    }
  }

  if (hasRunningMotion()) schedule();

  const media = window.matchMedia?.("(prefers-color-scheme: dark)");
  if (media?.addEventListener) media.addEventListener("change", schedule);
  else media?.addListener?.(schedule);
  window.addEventListener("resize", schedule);

  return () => {
    if (frame !== null) window.cancelAnimationFrame(frame);
    observer?.disconnect();
    if (eventRoot) {
      for (const event of instantEvents)
        eventRoot.removeEventListener(event, schedule, true);
      for (const event of motionStartEvents)
        eventRoot.removeEventListener(event, startMotion, true);
      for (const event of motionEndEvents)
        eventRoot.removeEventListener(event, endMotion, true);
    } else {
      for (const element of readElements()) {
        for (const event of instantEvents)
          element.removeEventListener(event, schedule);
        for (const event of motionStartEvents)
          element.removeEventListener(event, startMotion);
        for (const event of motionEndEvents)
          element.removeEventListener(event, endMotion);
      }
    }
    if (media?.removeEventListener)
      media.removeEventListener("change", schedule);
    else media?.removeListener?.(schedule);
    window.removeEventListener("resize", schedule);
  };
}

function parseCssColor(input: string): RgbaColor | null {
  const color = input.trim().toLowerCase();
  if (!color || color === "transparent") return null;

  return (
    parseHexColor(color) ??
    parseRgbColor(color) ??
    parseOklchColor(color) ??
    parseOklabColor(color) ??
    parseLabColor(color) ??
    parseLchColor(color) ??
    parseColorFunction(color)
  );
}

function parseHexColor(color: string): RgbaColor | null {
  const match = color.match(/^#([\da-f]{3,8})$/i);
  if (!match) return null;

  const hex = match[1];
  if (hex.length === 3 || hex.length === 4) {
    const [r, g, b, a = "f"] = hex;
    return {
      r: Number.parseInt(r + r, 16),
      g: Number.parseInt(g + g, 16),
      b: Number.parseInt(b + b, 16),
      a: Number.parseInt(a + a, 16) / 255,
    };
  }

  if (hex.length !== 6 && hex.length !== 8) return null;
  return {
    r: Number.parseInt(hex.slice(0, 2), 16),
    g: Number.parseInt(hex.slice(2, 4), 16),
    b: Number.parseInt(hex.slice(4, 6), 16),
    a: hex.length === 8 ? Number.parseInt(hex.slice(6, 8), 16) / 255 : 1,
  };
}

function parseRgbColor(color: string): RgbaColor | null {
  const match = color.match(/^rgba?\((.*)\)$/i);
  if (!match) return null;

  const [channelsPart, slashAlpha] = match[1]
    .split("/")
    .map((part) => part.trim());
  const tokens = channelsPart.replaceAll(",", " ").split(/\s+/).filter(Boolean);
  if (tokens.length < 3 || tokens.length > 4) return null;

  const r = parseRgbChannel(tokens[0]);
  const g = parseRgbChannel(tokens[1]);
  const b = parseRgbChannel(tokens[2]);
  const alpha = parseAlpha(slashAlpha ?? tokens[3]);
  if (r === null || g === null || b === null || alpha === null) return null;

  return {
    r,
    g,
    b,
    a: alpha,
  };
}

function parseOklchColor(color: string): RgbaColor | null {
  const parts = parseFunctionParts(color, "oklch");
  if (!parts || parts.channels.length < 3) return null;

  const lightness = parseUnitInterval(parts.channels[0]);
  const chroma = parseNumberComponent(parts.channels[1], 0.004);
  const hue = parseHue(parts.channels[2]);
  if (lightness === null || chroma === null || hue === null) return null;
  const radians = (hue * Math.PI) / 180;

  return oklabToSrgb(
    lightness,
    chroma * Math.cos(radians),
    chroma * Math.sin(radians),
    parts.alpha,
  );
}

function parseOklabColor(color: string): RgbaColor | null {
  const parts = parseFunctionParts(color, "oklab");
  if (!parts || parts.channels.length < 3) return null;

  const lightness = parseUnitInterval(parts.channels[0]);
  const a = parseNumberComponent(parts.channels[1], 0.004);
  const b = parseNumberComponent(parts.channels[2], 0.004);
  if (lightness === null || a === null || b === null) return null;

  return oklabToSrgb(lightness, a, b, parts.alpha);
}

function parseLabColor(color: string): RgbaColor | null {
  const parts = parseFunctionParts(color, "lab");
  if (!parts || parts.channels.length < 3) return null;

  const lightness = parseLabLightness(parts.channels[0]);
  const a = parseNumberComponent(parts.channels[1], 1.25);
  const b = parseNumberComponent(parts.channels[2], 1.25);
  if (lightness === null || a === null || b === null) return null;

  return labToSrgb(lightness, a, b, parts.alpha);
}

function parseLchColor(color: string): RgbaColor | null {
  const parts = parseFunctionParts(color, "lch");
  if (!parts || parts.channels.length < 3) return null;

  const lightness = parseLabLightness(parts.channels[0]);
  const chroma = parseNumberComponent(parts.channels[1], 1.5);
  const hue = parseHue(parts.channels[2]);
  if (lightness === null || chroma === null || hue === null) return null;
  const radians = (hue * Math.PI) / 180;
  return labToSrgb(
    lightness,
    chroma * Math.cos(radians),
    chroma * Math.sin(radians),
    parts.alpha,
  );
}

function parseColorFunction(color: string): RgbaColor | null {
  const match = color.match(
    /^color\(\s*(srgb(?:-linear)?|display-p3)\s+(.+)\)$/i,
  );
  if (!match) return null;

  const [channelsPart, alphaPart] = match[2]
    .split("/")
    .map((part) => part.trim());
  const channels = channelsPart
    .split(/\s+/)
    .filter(Boolean)
    .map((value) => parseNumberComponent(value, 0.01));
  const alpha = parseAlpha(alphaPart);
  if (
    channels.length !== 3 ||
    channels.some((value) => value === null) ||
    alpha === null
  ) {
    return null;
  }

  const [first, second, third] = channels as [number, number, number];

  if (match[1] === "display-p3") {
    return displayP3ToSrgb(first, second, third, alpha);
  }

  const normalized =
    match[1] === "srgb-linear"
      ? [linearToSrgb(first), linearToSrgb(second), linearToSrgb(third)]
      : [first, second, third];

  return {
    r: clamp(normalized[0], 0, 1) * 255,
    g: clamp(normalized[1], 0, 1) * 255,
    b: clamp(normalized[2], 0, 1) * 255,
    a: alpha,
  };
}

function parseFunctionParts(color: string, name: string) {
  const match = color.match(new RegExp(`^${name}\\((.*)\\)$`, "i"));
  if (!match) return null;

  const [channelsPart, alphaPart] = match[1]
    .split("/")
    .map((part) => part.trim());
  const alpha = parseAlpha(alphaPart);
  if (alpha === null) return null;

  return {
    channels: channelsPart.split(/\s+/).filter(Boolean),
    alpha,
  };
}

function oklabToSrgb(
  lightness: number,
  a: number,
  b: number,
  alpha: number,
): RgbaColor {
  const lRoot = lightness + 0.3963377774 * a + 0.2158037573 * b;
  const mRoot = lightness - 0.1055613458 * a - 0.0638541728 * b;
  const sRoot = lightness - 0.0894841775 * a - 1.291485548 * b;
  const l = lRoot ** 3;
  const m = mRoot ** 3;
  const s = sRoot ** 3;

  return linearRgbToSrgb(
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
    alpha,
  );
}

function labToSrgb(
  lightness: number,
  a: number,
  b: number,
  alpha: number,
): RgbaColor {
  const fy = (lightness + 16) / 116;
  const fx = fy + a / 500;
  const fz = fy - b / 200;
  const xD50 = 0.96422 * labPivotInverse(fx);
  const yD50 = labPivotInverse(fy);
  const zD50 = 0.82521 * labPivotInverse(fz);

  const x = 0.9555766 * xD50 - 0.0230393 * yD50 + 0.0631636 * zD50;
  const y = -0.0282895 * xD50 + 1.0099416 * yD50 + 0.0210077 * zD50;
  const z = 0.0122982 * xD50 - 0.020483 * yD50 + 1.3299098 * zD50;

  return linearRgbToSrgb(
    3.2404542 * x - 1.5371385 * y - 0.4985314 * z,
    -0.969266 * x + 1.8760108 * y + 0.041556 * z,
    0.0556434 * x - 0.2040259 * y + 1.0572252 * z,
    alpha,
  );
}

function displayP3ToSrgb(
  r: number,
  g: number,
  b: number,
  alpha: number,
): RgbaColor {
  const encoded = {
    r: clamp(r, 0, 1),
    g: clamp(g, 0, 1),
    b: clamp(b, 0, 1),
  };
  const red = srgbToLinear(encoded.r);
  const green = srgbToLinear(encoded.g);
  const blue = srgbToLinear(encoded.b);

  const x = 0.4865709486 * red + 0.2656676932 * green + 0.1982172852 * blue;
  const y = 0.2289745641 * red + 0.6917385218 * green + 0.0792869141 * blue;
  const z = 0.0451133819 * green + 1.0439443689 * blue;

  return {
    ...linearRgbToSrgb(
      3.2404542 * x - 1.5371385 * y - 0.4985314 * z,
      -0.969266 * x + 1.8760108 * y + 0.041556 * z,
      0.0556434 * x - 0.2040259 * y + 1.0572252 * z,
      alpha,
    ),
    luminance: y,
    displayP3: encoded,
  };
}

function linearRgbToSrgb(
  r: number,
  g: number,
  b: number,
  alpha: number,
): RgbaColor {
  return {
    r: clamp(linearToSrgb(r), 0, 1) * 255,
    g: clamp(linearToSrgb(g), 0, 1) * 255,
    b: clamp(linearToSrgb(b), 0, 1) * 255,
    a: clamp(alpha, 0, 1),
  };
}

function composite(foreground: RgbaColor, background: RgbaColor): RgbaColor {
  const alpha = foreground.a + background.a * (1 - foreground.a);
  if (alpha <= 0) return { r: 0, g: 0, b: 0, a: 0 };

  if (foreground.displayP3 || background.displayP3) {
    const front = toDisplayP3(foreground);
    const back = toDisplayP3(background);
    return displayP3ToSrgb(
      (front.r * foreground.a + back.r * background.a * (1 - foreground.a)) /
        alpha,
      (front.g * foreground.a + back.g * background.a * (1 - foreground.a)) /
        alpha,
      (front.b * foreground.a + back.b * background.a * (1 - foreground.a)) /
        alpha,
      alpha,
    );
  }

  return {
    r:
      (foreground.r * foreground.a +
        background.r * background.a * (1 - foreground.a)) /
      alpha,
    g:
      (foreground.g * foreground.a +
        background.g * background.a * (1 - foreground.a)) /
      alpha,
    b:
      (foreground.b * foreground.a +
        background.b * background.a * (1 - foreground.a)) /
      alpha,
    a: alpha,
  };
}

function toDisplayP3(color: RgbaColor) {
  if (color.displayP3) return color.displayP3;

  const red = srgbToLinear(clamp(color.r / 255, 0, 1));
  const green = srgbToLinear(clamp(color.g / 255, 0, 1));
  const blue = srgbToLinear(clamp(color.b / 255, 0, 1));
  const x = 0.4124564 * red + 0.3575761 * green + 0.1804375 * blue;
  const y = 0.2126729 * red + 0.7151522 * green + 0.072175 * blue;
  const z = 0.0193339 * red + 0.119192 * green + 0.9503041 * blue;

  return {
    r: clamp(
      linearToSrgb(2.4934969119 * x - 0.9313836179 * y - 0.4027107845 * z),
      0,
      1,
    ),
    g: clamp(
      linearToSrgb(-0.8294889696 * x + 1.7626640603 * y + 0.0236246858 * z),
      0,
      1,
    ),
    b: clamp(
      linearToSrgb(0.0358458302 * x - 0.0761723893 * y + 0.956884524 * z),
      0,
      1,
    ),
  };
}

function relativeLuminance({ r, g, b, luminance }: RgbaColor) {
  if (luminance !== undefined) return luminance;
  return (
    0.2126 * srgbToLinear(r / 255) +
    0.7152 * srgbToLinear(g / 255) +
    0.0722 * srgbToLinear(b / 255)
  );
}

function parseRgbChannel(value: string): number | null {
  if (value === "none") return 0;
  const parsed = value.endsWith("%")
    ? Number(value.slice(0, -1)) * 2.55
    : Number(value);
  return Number.isFinite(parsed) ? clamp(parsed, 0, 255) : null;
}

function parseAlpha(value: string | undefined): number | null {
  if (!value || value === "none") return 1;
  const parsed = value.endsWith("%")
    ? Number(value.slice(0, -1)) / 100
    : Number(value);
  return Number.isFinite(parsed) ? clamp(parsed, 0, 1) : null;
}

function parseUnitInterval(value: string): number | null {
  if (value === "none") return 0;
  const parsed = value.endsWith("%")
    ? Number(value.slice(0, -1)) / 100
    : Number(value);
  return Number.isFinite(parsed) ? clamp(parsed, 0, 1) : null;
}

function parseLabLightness(value: string): number | null {
  if (value === "none") return 0;
  const parsed = Number(value.endsWith("%") ? value.slice(0, -1) : value);
  return Number.isFinite(parsed) ? clamp(parsed, 0, 100) : null;
}

function parseNumberComponent(
  value: string,
  percentScale: number,
): number | null {
  if (value === "none") return 0;
  const parsed = value.endsWith("%")
    ? Number(value.slice(0, -1)) * percentScale
    : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseHue(value: string): number | null {
  if (value === "none") return 0;

  let parsed: number;
  if (value.endsWith("turn")) parsed = Number(value.slice(0, -4)) * 360;
  else if (value.endsWith("grad")) parsed = Number(value.slice(0, -4)) * 0.9;
  else if (value.endsWith("rad"))
    parsed = (Number(value.slice(0, -3)) * 180) / Math.PI;
  else if (value.endsWith("deg")) parsed = Number(value.slice(0, -3));
  else parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : null;
}

function labPivotInverse(value: number) {
  const cube = value ** 3;
  return cube > 216 / 24389 ? cube : (116 * value - 16) / (24389 / 27);
}

function srgbToLinear(value: number) {
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function linearToSrgb(value: number) {
  return value <= 0.0031308
    ? value * 12.92
    : 1.055 * value ** (1 / 2.4) - 0.055;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

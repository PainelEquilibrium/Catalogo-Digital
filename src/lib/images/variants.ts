export const IMAGE_VARIANTS = {
  thumb: { maxSide: 400 },
  card: { maxSide: 800 },
  detail: { maxSide: 1600 },
  og: { maxSide: 1200, jpegQuality: 78 },
} as const;

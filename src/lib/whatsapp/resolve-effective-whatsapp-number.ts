export function resolveEffectiveWhatsappNumber(
  brandingNumber: string,
  envNumber: string | undefined,
): string | null {
  const brandingDigits = brandingNumber.replace(/\D/g, "");
  if (brandingDigits.length > 0) {
    return brandingNumber;
  }

  const envDigits = (envNumber ?? "").replace(/\D/g, "");
  if (envDigits.length > 0) {
    return envNumber ?? null;
  }

  return null;
}

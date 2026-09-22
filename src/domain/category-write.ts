export function trashCategoryBlocker(
  activeProductCount: number,
): "has_active_products" | null {
  return activeProductCount > 0 ? "has_active_products" : null;
}

export function renamedFieldKeys(input: {
  previousKeys: readonly string[];
  next: readonly { key: string; previousKey?: string }[];
}): string[] {
  const renamed: string[] = [];
  for (const field of input.next) {
    if (
      field.previousKey !== undefined &&
      field.previousKey !== field.key
    ) {
      renamed.push(field.previousKey);
    }
  }
  return renamed;
}

export function suggestCopySlug(
  slug: string,
  taken: ReadonlySet<string>,
): string {
  const base = `${slug}-copia`;
  if (!taken.has(base)) {
    return base;
  }
  let n = 2;
  while (taken.has(`${base}-${n}`)) {
    n += 1;
  }
  return `${base}-${n}`;
}

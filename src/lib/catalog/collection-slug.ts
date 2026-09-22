const COLLECTION_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isValidCollectionSlug(slug: string): boolean {
  return COLLECTION_SLUG_PATTERN.test(slug);
}

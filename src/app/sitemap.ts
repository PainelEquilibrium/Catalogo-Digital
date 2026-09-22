import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/config/site";
import { querySitemapPaths } from "@/lib/catalog/query-sitemap-paths";

export const dynamic = "force-dynamic";

function absoluteUrl(path: string, base: string): string {
  if (path === "/") {
    return `${base}/`;
  }
  return `${base}${path}`;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getSiteUrl();
  const paths = await querySitemapPaths();

  return paths.map((entry) => ({
    url: absoluteUrl(entry.path, base),
    lastModified: entry.lastModified,
  }));
}

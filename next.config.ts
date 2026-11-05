import type { NextConfig } from "next";

function supabaseImageHost(): string | null {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!raw) return null;
  try {
    return new URL(raw).hostname;
  } catch {
    return null;
  }
}

const remotePatterns: NonNullable<NextConfig["images"]>["remotePatterns"] = [
  {
    protocol: "https",
    hostname: "placehold.co",
    pathname: "/**",
  },
  {
    protocol: "https",
    hostname: "**.supabase.co",
    pathname: "/**",
  },
];

const supabaseHost = supabaseImageHost();
if (supabaseHost) {
  remotePatterns.push({
    protocol: "https",
    hostname: supabaseHost,
    pathname: "/**",
  });
}

const nextConfig: NextConfig = {
  // Uploads de até 8 MB (MAX_UPLOAD_BYTES) mais o multipart; o padrão do Next é 1 MB.
  experimental: { serverActions: { bodySizeLimit: "9mb" } },
  images: {
    remotePatterns,
  },
};

export default nextConfig;

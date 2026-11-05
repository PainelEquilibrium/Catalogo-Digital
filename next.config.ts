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
  // Vercel recusa corpos acima de 4,5 MB; uploads de até 4 MiB (MAX_UPLOAD_BYTES) mais o multipart. O padrão do Next é 1 MB.
  experimental: { serverActions: { bodySizeLimit: "4.5mb" } },
  images: {
    remotePatterns,
  },
};

export default nextConfig;

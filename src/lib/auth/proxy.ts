import { createServerClient, parseCookieHeader } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabasePublicConfig } from "@/lib/auth/supabase-env";

const ADMIN_AUTH_PATHS = new Set([
  "/admin/login",
  "/admin/recuperar-senha",
  "/admin/atualizar-senha",
]);

function isProtectedAdminPath(pathname: string): boolean {
  if (!pathname.startsWith("/admin")) {
    return false;
  }
  if (ADMIN_AUTH_PATHS.has(pathname)) {
    return false;
  }
  for (const path of ADMIN_AUTH_PATHS) {
    if (pathname.startsWith(`${path}/`)) {
      return false;
    }
  }
  return true;
}

function copyCookies(from: NextResponse, to: NextResponse): void {
  for (const cookie of from.cookies.getAll()) {
    to.cookies.set(cookie.name, cookie.value);
  }
}

function forwardRequestHeaders(request: NextRequest): Headers {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", request.nextUrl.pathname);
  return requestHeaders;
}

export async function updateAdminSession(
  request: NextRequest,
): Promise<NextResponse> {
  const pathname = request.nextUrl.pathname;
  let url: string;
  let anonKey: string;
  try {
    const config = getSupabasePublicConfig();
    url = config.url;
    anonKey = config.anonKey;
  } catch (error) {
    if (!pathname.startsWith("/admin")) {
      return NextResponse.next();
    }
    throw error;
  }

  const requestHeaders = forwardRequestHeaders(request);

  let supabaseResponse = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return parseCookieHeader(request.cookies.toString());
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
        });
        supabaseResponse = NextResponse.next({
          request: {
            headers: forwardRequestHeaders(request),
          },
        });
        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options);
        });
        Object.entries(headers).forEach(([key, value]) => {
          supabaseResponse.headers.set(key, value);
        });
      },
    },
  });

  await supabase.auth.getClaims();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && isProtectedAdminPath(request.nextUrl.pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/admin/login";
    loginUrl.search = "";
    const redirectResponse = NextResponse.redirect(loginUrl);
    copyCookies(supabaseResponse, redirectResponse);
    return redirectResponse;
  }

  return supabaseResponse;
}

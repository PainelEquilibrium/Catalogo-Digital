import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { getSupabasePublicConfig } from "@/lib/auth/supabase-env";
import { prisma } from "@/lib/prisma/client";
import { canPerform, type StaffAction } from "@/lib/auth/permissions";
import { parseStaffRole, type StaffRole } from "@/lib/auth/roles";

export type StaffSession = {
  userId: string;
  email: string;
  name: string;
  role: StaffRole;
};

type StaffAuthCode = "unauthenticated" | "forbidden" | "password_change_required";

export class StaffAuthError extends Error {
  readonly code: StaffAuthCode;

  constructor(code: StaffAuthCode, message?: string) {
    super(
      message ??
        (code === "unauthenticated"
          ? "Sessão não encontrada."
          : code === "password_change_required"
            ? "Troca de senha obrigatória."
            : "Sem permissão para o painel."),
    );
    this.name = "StaffAuthError";
    this.code = code;
  }
}

export async function createServerSupabase(): Promise<SupabaseClient> {
  const { url, anonKey } = getSupabasePublicConfig();
  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Component sem mutação de cookies; o proxy renova a sessão.
        }
      },
    },
  });
}

export async function requireSignedInProfile(): Promise<
  StaffSession & { mustChangePassword: boolean }
> {
  getSupabasePublicConfig();

  const supabase = await createServerSupabase();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new StaffAuthError("unauthenticated");
  }

  const profile = await prisma.profile.findUnique({
    where: { id: user.id },
  });

  const role = parseStaffRole(profile?.role);
  if (!profile || !role || !profile.isActive) {
    throw new StaffAuthError("forbidden");
  }

  return {
    userId: user.id,
    email: profile.email,
    name: profile.name,
    role,
    mustChangePassword: profile.mustChangePassword,
  };
}

export async function requireStaff(): Promise<StaffSession> {
  const { mustChangePassword, ...session } = await requireSignedInProfile();
  if (mustChangePassword) {
    throw new StaffAuthError("password_change_required");
  }
  return session;
}

export async function requireAction(
  action: StaffAction,
): Promise<StaffSession> {
  const session = await requireStaff();
  if (!canPerform(session.role, action)) {
    throw new StaffAuthError("forbidden");
  }
  return session;
}

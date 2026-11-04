import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AdminChrome } from "@/components/admin/admin-chrome";
import { resolveBranding } from "@/lib/branding/resolve-branding";
import { requireStaff, StaffAuthError, type StaffSession } from "@/lib/auth/server";

function isForbiddenPage(pathname: string): boolean {
  return (
    pathname === "/admin/sem-acesso" ||
    pathname.startsWith("/admin/sem-acesso/")
  );
}

export default async function AdminPanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = (await headers()).get("x-pathname") ?? "";
  const branding = await resolveBranding();

  let session: StaffSession;
  try {
    session = await requireStaff();
  } catch (error) {
    if (!(error instanceof StaffAuthError)) {
      throw error;
    }
    if (error.code === "unauthenticated") {
      redirect("/admin/login");
    }
    if (error.code === "password_change_required") {
      redirect("/admin/atualizar-senha");
    }
    if (isForbiddenPage(pathname)) {
      return <div className="mx-auto w-full max-w-lg px-4 py-10">{children}</div>;
    }
    redirect("/admin/sem-acesso");
  }

  return <AdminChrome branding={branding} role={session.role}>{children}</AdminChrome>;
}

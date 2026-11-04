import { redirect } from "next/navigation";
import { AdminAuthFrame } from "@/components/admin/admin-auth-frame";
import { AdminLoginForm } from "@/components/admin/admin-login-form";
import { resolveBranding } from "@/lib/branding/resolve-branding";
import { requireSignedInProfile, StaffAuthError } from "@/lib/auth/server";
import { copyAdminPtBr } from "@/lib/copy/admin-pt-br";

export default async function AdminLoginPage() {
  let target: string | null = null;
  try {
    const { mustChangePassword } = await requireSignedInProfile();
    target = mustChangePassword ? "/admin/atualizar-senha" : "/admin/produtos";
  } catch (error) {
    if (error instanceof StaffAuthError && error.code === "forbidden") {
      target = "/admin/sem-acesso";
    }
  }
  if (target) redirect(target);

  const branding = await resolveBranding();

  return (
    <AdminAuthFrame branding={branding} title={copyAdminPtBr.login.title}>
      <AdminLoginForm />
    </AdminAuthFrame>
  );
}

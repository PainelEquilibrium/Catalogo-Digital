import { redirect } from "next/navigation";
import { AdminAuthFrame } from "@/components/admin/admin-auth-frame";
import { AdminLoginForm } from "@/components/admin/admin-login-form";
import { resolveBranding } from "@/lib/branding/resolve-branding";
import { requireStaff, StaffAuthError } from "@/lib/auth/server";
import { copyAdminPtBr } from "@/lib/copy/admin-pt-br";

export default async function AdminLoginPage() {
  try {
    await requireStaff();
    redirect("/admin/produtos");
  } catch (error) {
    if (error instanceof StaffAuthError && error.code === "forbidden") {
      redirect("/admin/sem-acesso");
    }
  }

  const branding = await resolveBranding();

  return (
    <AdminAuthFrame branding={branding} title={copyAdminPtBr.login.title}>
      <AdminLoginForm />
    </AdminAuthFrame>
  );
}

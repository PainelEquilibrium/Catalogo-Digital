import { resolveBranding } from "@/lib/branding/resolve-branding";
import "./admin.css";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await resolveBranding();

  return <div className="admin-shell flex min-h-full flex-1 flex-col">{children}</div>;
}

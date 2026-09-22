"use client";

import { useRouter } from "next/navigation";
import { PoweredByEquilibrium } from "@/components/PoweredByEquilibrium";
import { Button } from "@/components/ui/button";
import { createBrowserSupabase } from "@/lib/auth/browser";
import { copyAdminPtBr } from "@/lib/copy/admin-pt-br";

export default function AdminForbiddenPage() {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createBrowserSupabase();
    await supabase.auth.signOut();
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-6 text-center">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          {copyAdminPtBr.forbidden.title}
        </h1>
        <p className="text-sm text-muted-foreground">
          {copyAdminPtBr.forbidden.description}
        </p>
      </div>
      <Button type="button" variant="outline" onClick={() => void handleSignOut()}>
        {copyAdminPtBr.chrome.signOut}
      </Button>
      <PoweredByEquilibrium
        variant="footer"
        label={copyAdminPtBr.chrome.poweredBy}
        showTextFallback={false}
      />
    </div>
  );
}

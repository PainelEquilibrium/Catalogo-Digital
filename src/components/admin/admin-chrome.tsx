"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { Branding } from "@/domain/branding";
import { PoweredByEquilibrium } from "@/components/PoweredByEquilibrium";
import { Button } from "@/components/ui/button";
import { createBrowserSupabase } from "@/lib/auth/browser";
import { copyAdminPtBr } from "@/lib/copy/admin-pt-br";
import { cn } from "@/lib/utils";

type AdminChromeProps = {
  branding: Branding;
  children: React.ReactNode;
};

const navItems = [
  { href: "/admin/produtos", label: copyAdminPtBr.chrome.products },
  { href: "/admin/categorias", label: copyAdminPtBr.chrome.categories },
  { href: "/admin/lixeira", label: copyAdminPtBr.chrome.trash },
] as const;

export function AdminChrome({ branding, children }: AdminChromeProps) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createBrowserSupabase();
    await supabase.auth.signOut();
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 py-3 sm:px-6">
          <Link
            href="/admin/produtos"
            className="flex shrink-0 items-center gap-3 text-foreground"
          >
            <Image
              src={branding.store.logo_url}
              alt={branding.store.name}
              width={120}
              height={40}
              className="h-8 w-auto object-contain"
              priority
            />
            <span className="text-sm font-medium">{branding.store.name}</span>
          </Link>
          <nav className="flex flex-1 flex-wrap items-center gap-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  pathname === item.href || pathname.startsWith(`${item.href}/`)
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <Button type="button" variant="outline" onClick={() => void handleSignOut()}>
            {copyAdminPtBr.chrome.signOut}
          </Button>
        </div>
      </header>
      <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">{children}</div>
      <footer className="border-t border-border py-6">
        <div className="mx-auto flex max-w-6xl justify-center px-4 sm:px-6">
          <PoweredByEquilibrium
            variant="footer"
            label={copyAdminPtBr.chrome.poweredBy}
            showTextFallback={false}
          />
        </div>
      </footer>
    </div>
  );
}

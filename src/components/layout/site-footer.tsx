import Link from "next/link";
import { PoweredByEquilibrium } from "@/components/PoweredByEquilibrium";
import { copyPtBr } from "@/lib/copy/pt-br";

const legalLinks = [
  { href: "/privacidade", label: copyPtBr.legal.privacidade },
  { href: "/cookies", label: copyPtBr.legal.cookies },
  { href: "/termos", label: copyPtBr.legal.termos },
] as const;

export function SiteFooter() {
  return (
    <footer
      className="mt-auto border-t border-[color-mix(in_srgb,var(--color-text)_10%,transparent)] bg-[var(--color-background)]"
    >
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-5 px-4 py-6 sm:px-6">
        <nav
          className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm"
          aria-label="Informações legais"
        >
          {legalLinks.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-[color-mix(in_srgb,var(--color-text)_70%,transparent)] underline-offset-4 transition-colors hover:text-[var(--color-primary)] hover:underline"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <PoweredByEquilibrium
          variant="footer"
          label={copyPtBr.poweredByLabel}
          showTextFallback={false}
        />
      </div>
    </footer>
  );
}

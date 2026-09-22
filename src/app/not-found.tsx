import Link from "next/link";
import { copyPtBr } from "@/lib/copy/pt-br";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-4 px-4 py-24 text-center">
      <h1 className="font-[family-name:var(--font-heading)] text-2xl text-[var(--color-text)]">
        {copyPtBr.notFound.title}
      </h1>
      <p className="text-[color-mix(in_srgb,var(--color-text)_75%,transparent)]">
        {copyPtBr.notFound.description}
      </p>
      <Link
        href="/"
        className="rounded-[var(--radius)] border border-[color-mix(in_srgb,var(--color-text)_20%,transparent)] px-4 py-2 text-sm text-[var(--color-text)] transition-colors hover:bg-[color-mix(in_srgb,var(--color-primary)_8%,transparent)]"
      >
        {copyPtBr.notFound.backHome}
      </Link>
    </div>
  );
}

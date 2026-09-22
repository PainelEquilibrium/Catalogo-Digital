import {
  markdownToHtml,
  stripLeadingH1,
} from "@/lib/legal/markdown-to-html";

type LegalArticleProps = {
  title: string;
  markdown: string;
};

export function LegalArticle({ title, markdown }: LegalArticleProps) {
  const body = stripLeadingH1(markdown);
  const html = markdownToHtml(body);

  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <header className="mb-8 border-b border-[color-mix(in_srgb,var(--color-text)_10%,transparent)] pb-6">
        <h1
          className="font-[family-name:var(--font-heading)] text-3xl text-[var(--color-text)]"
        >
          {title}
        </h1>
      </header>
      <div
        className="legal-prose space-y-4 text-[color-mix(in_srgb,var(--color-text)_85%,transparent)] [&_h2]:mt-8 [&_h2]:font-[family-name:var(--font-heading)] [&_h2]:text-xl [&_h2]:text-[var(--color-text)] [&_h3]:mt-6 [&_h3]:text-lg [&_h3]:font-medium [&_h3]:text-[var(--color-text)] [&_hr]:my-8 [&_hr]:border-[color-mix(in_srgb,var(--color-text)_15%,transparent)] [&_li]:ml-4 [&_li]:list-disc [&_strong]:text-[var(--color-text)] [&_ul]:space-y-2"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </article>
  );
}

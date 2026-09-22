function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function inlineMarkdown(text: string): string {
  let out = escapeHtml(text);
  out = out.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/\*(.+?)\*/g, "<em>$1</em>");
  return out;
}

/**
 * Converte markdown simples (legais Equilibrium) em HTML seguro.
 * Não é um parser completo — cobre títulos, listas, parágrafos e hr.
 */
export function markdownToHtml(markdown: string): string {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const parts: string[] = [];
  let inList = false;

  const closeList = () => {
    if (inList) {
      parts.push("</ul>");
      inList = false;
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed === "") {
      closeList();
      continue;
    }

    if (trimmed === "---") {
      closeList();
      parts.push("<hr />");
      continue;
    }

    const heading = /^(#{1,3})\s+(.+)$/.exec(trimmed);
    if (heading) {
      closeList();
      const level = heading[1].length;
      const tag = level === 1 ? "h1" : level === 2 ? "h2" : "h3";
      parts.push(`<${tag}>${inlineMarkdown(heading[2])}</${tag}>`);
      continue;
    }

    if (trimmed.startsWith("- ")) {
      if (!inList) {
        parts.push("<ul>");
        inList = true;
      }
      parts.push(`<li>${inlineMarkdown(trimmed.slice(2))}</li>`);
      continue;
    }

    closeList();
    parts.push(`<p>${inlineMarkdown(trimmed)}</p>`);
  }

  closeList();
  return parts.join("\n");
}

/** Remove o primeiro heading nível 1 do markdown (o h1 vem da página). */
export function stripLeadingH1(markdown: string): string {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const firstNonEmpty = lines.findIndex((line) => line.trim() !== "");
  if (firstNonEmpty === -1) {
    return markdown;
  }
  if (/^#\s+/.test(lines[firstNonEmpty].trim())) {
    lines.splice(firstNonEmpty, 1);
    if (lines[firstNonEmpty]?.trim() === "") {
      lines.splice(firstNonEmpty, 1);
    }
  }
  return lines.join("\n");
}

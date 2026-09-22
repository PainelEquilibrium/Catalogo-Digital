import { describe, expect, it, vi } from "vitest";
import { shareProductLink } from "./share-product-link";

const input = {
  url: "https://loja.example/produto/blusa-trico-cashmere",
  title: "Blusa Tricô Cashmere",
};

describe("shareProductLink", () => {
  it("usa Web Share API quando disponível", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const writeClipboard = vi.fn();
    const onCopied = vi.fn();

    await shareProductLink(input, {
      canWebShare: true,
      share,
      writeClipboard,
      onCopied,
    });

    expect(share).toHaveBeenCalledWith(input);
    expect(writeClipboard).not.toHaveBeenCalled();
    expect(onCopied).not.toHaveBeenCalled();
  });

  it("copia o link e dispara callback quando Web Share não existe", async () => {
    const share = vi.fn();
    const writeClipboard = vi.fn().mockResolvedValue(undefined);
    const onCopied = vi.fn();

    await shareProductLink(input, {
      canWebShare: false,
      share,
      writeClipboard,
      onCopied,
    });

    expect(share).not.toHaveBeenCalled();
    expect(writeClipboard).toHaveBeenCalledWith(input.url);
    expect(onCopied).toHaveBeenCalledOnce();
  });
});

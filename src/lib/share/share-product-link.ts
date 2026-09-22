export type ShareProductLinkDeps = {
  canWebShare: boolean;
  share: (data: { url: string; title: string }) => Promise<void>;
  writeClipboard: (text: string) => Promise<void>;
  onCopied: () => void;
};

export async function shareProductLink(
  input: { url: string; title: string },
  deps: ShareProductLinkDeps,
): Promise<void> {
  if (deps.canWebShare) {
    await deps.share({ url: input.url, title: input.title });
    return;
  }

  await deps.writeClipboard(input.url);
  deps.onCopied();
}

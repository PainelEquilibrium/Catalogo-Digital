import { copyAdminPtBr } from "@/lib/copy/admin-pt-br";

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

const copy = copyAdminPtBr.upload;

export type UploadErrorCode =
  | "too_large"
  | "heic"
  | "too_small"
  | "format"
  | "generic";

export function mapUploadError(
  error: unknown,
  byteLength: number,
): UploadErrorCode {
  if (byteLength > MAX_UPLOAD_BYTES) {
    return "too_large";
  }

  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";

  if (/HEIC/i.test(message)) {
    return "heic";
  }
  if (/800/.test(message)) {
    return "too_small";
  }
  if (/Unsupported image format/i.test(message)) {
    return "format";
  }

  return "generic";
}

export function messageForUploadError(code: UploadErrorCode): string {
  switch (code) {
    case "too_large":
      return copy.errorTooLarge;
    case "heic":
      return copy.errorHeic;
    case "too_small":
      return copy.errorTooSmall;
    case "format":
      return copy.errorFormat;
    default:
      return copy.errorGeneric;
  }
}

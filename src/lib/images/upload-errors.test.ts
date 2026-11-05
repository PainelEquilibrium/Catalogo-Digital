import { describe, expect, it } from "vitest";
import { MAX_UPLOAD_BYTES, mapUploadError } from "./upload-errors";

describe("mapUploadError", () => {
  it("classifica arquivo acima de 4 MiB", () => {
    expect(mapUploadError(new Error("ignored"), MAX_UPLOAD_BYTES + 1)).toBe(
      "too_large",
    );
  });

  it("classifica HEIC pela mensagem do sharp", () => {
    expect(
      mapUploadError(new Error("HEIC images are not supported"), 1024),
    ).toBe("heic");
  });

  it("classifica lado menor que 800px pela mensagem", () => {
    expect(
      mapUploadError(
        new Error("Image smallest side must be at least 800px"),
        1024,
      ),
    ).toBe("too_small");
  });

  it("classifica formato não suportado", () => {
    expect(
      mapUploadError(
        new Error("Unsupported image format: gif. Only JPEG, PNG and WebP are accepted."),
        1024,
      ),
    ).toBe("format");
  });

  it("classifica erro desconhecido como generic", () => {
    expect(mapUploadError(new Error("network"), 1024)).toBe("generic");
  });
});

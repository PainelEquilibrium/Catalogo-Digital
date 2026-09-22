import { describe, expect, it } from "vitest";
import {
  parseUtmFromSearch,
  persistUtmsFirstTouch,
  UTM_STORAGE_KEY,
} from "./utm";

describe("parseUtmFromSearch", () => {
  it("captura parâmetros UTM da query string", () => {
    expect(
      parseUtmFromSearch(
        "?utm_source=ig&utm_medium=story&utm_campaign=lancamento&utm_content=card&utm_term=vestido",
      ),
    ).toEqual({
      utm_source: "ig",
      utm_medium: "story",
      utm_campaign: "lancamento",
      utm_content: "card",
      utm_term: "vestido",
    });
  });

  it("ignora chaves vazias", () => {
    expect(parseUtmFromSearch("?utm_source=&foo=bar")).toEqual({});
  });
});

describe("persistUtmsFirstTouch", () => {
  it("grava só na primeira vez da sessão", () => {
    const storage = new Map<string, string>();
    const api = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
    };

    const first = persistUtmsFirstTouch(api, { utm_source: "a" });
    expect(first.utm_source).toBe("a");
    expect(storage.get(UTM_STORAGE_KEY)).toContain("a");

    const second = persistUtmsFirstTouch(api, { utm_source: "b" });
    expect(second.utm_source).toBe("a");
  });
});

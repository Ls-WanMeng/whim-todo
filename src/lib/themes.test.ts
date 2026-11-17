import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_PAIR,
  THEMES,
  THEME_IDS,
  getTheme,
  readThemePair,
  readThemePref,
  resolveThemeId,
  toggleTheme,
  writeThemePref,
} from "./themes";
import type { ThemeId } from "./themes";
import { LEGACY_THEME_KEY, THEME_KEY, THEME_PAIR_KEY } from "./themes";

function mem(init: Record<string, string> = {}) {
  const map = new Map(Object.entries(init));
  return {
    map,
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
    removeItem: (key: string) => {
      map.delete(key);
    },
    clear: () => map.clear(),
    key: (index: number) => [...map.keys()][index] ?? null,
    get length() {
      return map.size;
    },
  } satisfies Storage;
}

function luminance(hex: string): number {
  const value = hex.replace("#", "");
  const channels = [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16) / 255);
  const [r, g, b] = channels.map((c) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe("theme catalog", () => {
  it("ships eight themes with unique ids", () => {
    expect(THEMES).toHaveLength(8);
    expect(new Set(THEME_IDS).size).toBe(8);
    expect(THEME_IDS).toEqual([
      "abyss",
      "dune",
      "tundra",
      "neon",
      "mist",
      "paper",
      "sakura",
      "contrast",
    ]);
  });

  it("keeps body, subtle, button and accent text readable in every theme", () => {
    for (const theme of THEMES) {
      const tokens = theme.tokens;
      expect(contrast(tokens.foreground, tokens.background), `${theme.id} 正文`).toBeGreaterThanOrEqual(7);
      expect(contrast(tokens.subtle, tokens.background), `${theme.id} 辅助文字`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(tokens["on-primary"], tokens.primary), `${theme.id} 按钮文字`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(tokens.accent, tokens.background), `${theme.id} 强调色`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(tokens.primary, tokens.background), `${theme.id} 主色`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("declares every token in index.css so first paint has no flash", () => {
    const css = readFileSync("src/index.css", "utf8");

    for (const theme of THEMES) {
      const start = css.indexOf(`[data-theme="${theme.id}"]`);
      expect(start, `${theme.id} 缺少 CSS 块`).toBeGreaterThan(-1);
      const end = css.indexOf("}", start);
      const block = css.slice(start, end);

      for (const [key, value] of Object.entries(theme.tokens)) {
        expect(block, `${theme.id} 缺少 --color-${key}`).toContain(`--color-${key}: ${value};`);
      }
    }
  });

  it("exposes theme colors for the scene and effects", () => {
    const theme = getTheme("dune");

    expect(theme.label).toBe("落日沙丘");
    expect(theme.mode).toBe("dark");
    expect(theme.scene.colors).toHaveLength(3);
    expect(theme.effects.confetti.length).toBeGreaterThanOrEqual(3);
    expect(theme.effects.spotlight).toMatch(/^#/);
  });
});

describe("readThemePref", () => {
  it("defaults to auto when nothing is stored", () => {
    expect(readThemePref(mem())).toBe("auto");
  });

  it("migrates the legacy dark/light key", () => {
    expect(readThemePref(mem({ [LEGACY_THEME_KEY]: "dark" }))).toBe("abyss");
    expect(readThemePref(mem({ [LEGACY_THEME_KEY]: "light" }))).toBe("mist");
  });

  it("ignores unknown ids", () => {
    expect(readThemePref(mem({ [THEME_KEY]: "vaporwave" }))).toBe("auto");
    expect(readThemePref(mem({ [THEME_KEY]: "neon" }))).toBe("neon");
  });

  it("survives storage failures", () => {
    const broken = mem();
    broken.getItem = () => {
      throw new Error("SecurityError");
    };
    expect(readThemePref(broken)).toBe("auto");
  });
});

describe("writeThemePref", () => {
  it("round-trips a theme id", () => {
    const storage = mem();
    writeThemePref(storage, "sakura");

    expect(storage.map.get(THEME_KEY)).toBe("sakura");
    expect(readThemePref(storage)).toBe("sakura");
  });
});

describe("theme pair", () => {
  it("falls back to defaults when missing or invalid", () => {
    expect(readThemePair(mem())).toEqual(DEFAULT_PAIR);
    expect(readThemePair(mem({ [THEME_PAIR_KEY]: "{oops" }))).toEqual(DEFAULT_PAIR);
    expect(
      readThemePair(mem({ [THEME_PAIR_KEY]: JSON.stringify({ dark: "nope", light: "paper" }) })),
    ).toEqual({ dark: DEFAULT_PAIR.dark, light: "paper" });
  });

  it("ignores a light theme stored as the dark side", () => {
    expect(
      readThemePair(mem({ [THEME_PAIR_KEY]: JSON.stringify({ dark: "mist", light: "abyss" }) })),
    ).toEqual(DEFAULT_PAIR);
  });
});

describe("resolveThemeId", () => {
  it("returns the explicit selection", () => {
    expect(resolveThemeId("paper", true, DEFAULT_PAIR)).toBe("paper");
  });

  it("follows the system when set to auto", () => {
    const pair = { dark: "neon", light: "sakura" } satisfies Record<"dark" | "light", ThemeId>;

    expect(resolveThemeId("auto", true, pair)).toBe("neon");
    expect(resolveThemeId("auto", false, pair)).toBe("sakura");
  });
});

describe("toggleTheme", () => {
  it("switches to the remembered light theme and records the dark one", () => {
    const next = toggleTheme("dune", { dark: "abyss", light: "mist" });

    expect(next.theme).toBe("mist");
    expect(next.pair).toEqual({ dark: "dune", light: "mist" });
  });

  it("switches back to the remembered dark theme", () => {
    const next = toggleTheme("sakura", { dark: "dune", light: "sakura" });

    expect(next.theme).toBe("dune");
    expect(next.pair).toEqual({ dark: "dune", light: "sakura" });
  });
});

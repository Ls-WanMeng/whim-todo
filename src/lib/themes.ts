export const THEME_KEY = "whim-todo:theme";
export const THEME_PAIR_KEY = "whim-todo:theme-pair";
export const LEGACY_THEME_KEY = "dsh-demo-theme";

export const THEME_IDS = [
  "abyss",
  "dune",
  "tundra",
  "neon",
  "mist",
  "paper",
  "sakura",
  "contrast",
] as const;

export type ThemeId = (typeof THEME_IDS)[number];
export type ThemePref = ThemeId | "auto";
export type ThemeMode = "dark" | "light";
export type ThemePair = Record<ThemeMode, ThemeId>;

export type ThemeTokens = {
  primary: string;
  "primary-strong": string;
  "on-primary": string;
  accent: string;
  background: string;
  foreground: string;
  card: string;
  "card-foreground": string;
  muted: string;
  "muted-foreground": string;
  subtle: string;
  border: string;
  destructive: string;
  ring: string;
  "focus-ring": string;
  shadow: string;
};

export type ThemeDef = {
  id: ThemeId;
  label: string;
  mode: ThemeMode;
  tokens: ThemeTokens;
  scene: {
    kind: "aurora" | "grainient" | "none";
    colors: [string, string, string];
    opacity: number;
  };
  effects: {
    confetti: string[];
    spotlight: string;
  };
};

export const THEMES: ThemeDef[] = [
  {
    id: "abyss",
    label: "深海极光",
    mode: "dark",
    tokens: {
      primary: "#2dd4bf",
      "primary-strong": "#5eead4",
      "on-primary": "#04211f",
      accent: "#fb923c",
      background: "#0b1120",
      foreground: "#e9f1f7",
      card: "rgba(17, 24, 39, 0.55)",
      "card-foreground": "#e9f1f7",
      muted: "rgba(148, 163, 184, 0.12)",
      "muted-foreground": "#cbd5e1",
      subtle: "#94a3b8",
      border: "rgba(148, 163, 184, 0.24)",
      destructive: "#f87171",
      ring: "#2dd4bf",
      "focus-ring": "rgba(45, 212, 191, 0.38)",
      shadow: "0 20px 60px rgba(2, 6, 23, 0.45)",
    },
    scene: {
      kind: "aurora",
      colors: ["#2dd4bf", "#6366f1", "#fb923c"],
      opacity: 0.6,
    },
    effects: {
      confetti: ["#2dd4bf", "#fb923c", "#818cf8"],
      spotlight: "#2dd4bf",
    },
  },
  {
    id: "dune",
    label: "落日沙丘",
    mode: "dark",
    tokens: {
      primary: "#fb7185",
      "primary-strong": "#fda4af",
      "on-primary": "#2b0a11",
      accent: "#fbbf24",
      background: "#170f12",
      foreground: "#f7ecee",
      card: "rgba(38, 24, 29, 0.6)",
      "card-foreground": "#f7ecee",
      muted: "rgba(251, 113, 133, 0.12)",
      "muted-foreground": "#e6ccd2",
      subtle: "#c9a9b0",
      border: "rgba(251, 113, 133, 0.24)",
      destructive: "#fca5a5",
      ring: "#fb7185",
      "focus-ring": "rgba(251, 113, 133, 0.38)",
      shadow: "0 20px 60px rgba(23, 8, 12, 0.5)",
    },
    scene: {
      kind: "aurora",
      colors: ["#fb7185", "#fbbf24", "#a855f7"],
      opacity: 0.55,
    },
    effects: {
      confetti: ["#fb7185", "#fbbf24", "#c084fc"],
      spotlight: "#fb7185",
    },
  },
  {
    id: "tundra",
    label: "苔原森林",
    mode: "dark",
    tokens: {
      primary: "#4ade80",
      "primary-strong": "#86efac",
      "on-primary": "#052013",
      accent: "#facc15",
      background: "#0b1310",
      foreground: "#e7f3eb",
      card: "rgba(16, 32, 25, 0.6)",
      "card-foreground": "#e7f3eb",
      muted: "rgba(74, 222, 128, 0.12)",
      "muted-foreground": "#cfe5d7",
      subtle: "#9fb9ac",
      border: "rgba(74, 222, 128, 0.22)",
      destructive: "#fca5a5",
      ring: "#4ade80",
      "focus-ring": "rgba(74, 222, 128, 0.36)",
      shadow: "0 20px 60px rgba(3, 12, 8, 0.5)",
    },
    scene: {
      kind: "aurora",
      colors: ["#4ade80", "#22d3ee", "#a3e635"],
      opacity: 0.5,
    },
    effects: {
      confetti: ["#4ade80", "#facc15", "#22d3ee"],
      spotlight: "#4ade80",
    },
  },
  {
    id: "neon",
    label: "午夜霓虹",
    mode: "dark",
    tokens: {
      primary: "#a78bfa",
      "primary-strong": "#c4b5fd",
      "on-primary": "#170b33",
      accent: "#22d3ee",
      background: "#08060f",
      foreground: "#eeeaf9",
      card: "rgba(22, 15, 40, 0.62)",
      "card-foreground": "#eeeaf9",
      muted: "rgba(167, 139, 250, 0.14)",
      "muted-foreground": "#d8d2ec",
      subtle: "#a9a3c2",
      border: "rgba(167, 139, 250, 0.26)",
      destructive: "#fb7185",
      ring: "#a78bfa",
      "focus-ring": "rgba(167, 139, 250, 0.4)",
      shadow: "0 20px 70px rgba(8, 4, 20, 0.6)",
    },
    scene: {
      kind: "aurora",
      colors: ["#a78bfa", "#22d3ee", "#f472b6"],
      opacity: 0.62,
    },
    effects: {
      confetti: ["#a78bfa", "#22d3ee", "#f472b6"],
      spotlight: "#a78bfa",
    },
  },
  {
    id: "mist",
    label: "晨雾灰蓝",
    mode: "light",
    tokens: {
      primary: "#1d4ed8",
      "primary-strong": "#1e40af",
      "on-primary": "#ffffff",
      accent: "#c2410c",
      background: "#eef2f7",
      foreground: "#101a2b",
      card: "rgba(255, 255, 255, 0.66)",
      "card-foreground": "#101a2b",
      muted: "rgba(16, 26, 43, 0.06)",
      "muted-foreground": "#334155",
      subtle: "#52637a",
      border: "rgba(16, 26, 43, 0.14)",
      destructive: "#b91c1c",
      ring: "#1d4ed8",
      "focus-ring": "rgba(29, 78, 216, 0.32)",
      shadow: "0 20px 50px rgba(16, 26, 43, 0.14)",
    },
    scene: {
      kind: "aurora",
      colors: ["#93c5fd", "#c4b5fd", "#fbcfe8"],
      opacity: 0.35,
    },
    effects: {
      confetti: ["#1d4ed8", "#c2410c", "#7c3aed"],
      spotlight: "#1d4ed8",
    },
  },
  {
    id: "paper",
    label: "纸质手账",
    mode: "light",
    tokens: {
      primary: "#92400e",
      "primary-strong": "#78350f",
      "on-primary": "#ffffff",
      accent: "#4f46e5",
      background: "#f7f1e3",
      foreground: "#2b2118",
      card: "rgba(255, 252, 246, 0.8)",
      "card-foreground": "#2b2118",
      muted: "rgba(43, 33, 24, 0.07)",
      "muted-foreground": "#4a3c2e",
      subtle: "#6b5b48",
      border: "rgba(43, 33, 24, 0.16)",
      destructive: "#b91c1c",
      ring: "#92400e",
      "focus-ring": "rgba(146, 64, 14, 0.3)",
      shadow: "0 18px 44px rgba(43, 33, 24, 0.16)",
    },
    scene: {
      kind: "grainient",
      colors: ["#f3e3c3", "#e8d3ae", "#d9c19a"],
      opacity: 0.5,
    },
    effects: {
      confetti: ["#92400e", "#4f46e5", "#ca8a04"],
      spotlight: "#92400e",
    },
  },
  {
    id: "sakura",
    label: "樱花奶油",
    mode: "light",
    tokens: {
      primary: "#be185d",
      "primary-strong": "#9d174d",
      "on-primary": "#ffffff",
      accent: "#6d28d9",
      background: "#fff5f7",
      foreground: "#3a1526",
      card: "rgba(255, 255, 255, 0.78)",
      "card-foreground": "#3a1526",
      muted: "rgba(58, 21, 38, 0.06)",
      "muted-foreground": "#5c3346",
      subtle: "#7c5566",
      border: "rgba(58, 21, 38, 0.14)",
      destructive: "#b91c1c",
      ring: "#be185d",
      "focus-ring": "rgba(190, 24, 93, 0.3)",
      shadow: "0 20px 50px rgba(58, 21, 38, 0.12)",
    },
    scene: {
      kind: "grainient",
      colors: ["#ffd9e4", "#e9d5ff", "#fff1d6"],
      opacity: 0.55,
    },
    effects: {
      confetti: ["#be185d", "#7c3aed", "#fbbf24"],
      spotlight: "#be185d",
    },
  },
  {
    id: "contrast",
    label: "高对比",
    mode: "dark",
    tokens: {
      primary: "#ffe066",
      "primary-strong": "#fff3b0",
      "on-primary": "#000000",
      accent: "#66d9e8",
      background: "#000000",
      foreground: "#ffffff",
      card: "rgba(0, 0, 0, 0.92)",
      "card-foreground": "#ffffff",
      muted: "rgba(255, 255, 255, 0.14)",
      "muted-foreground": "#ffffff",
      subtle: "#ffffff",
      border: "#ffffff",
      destructive: "#ff8a8a",
      ring: "#ffe066",
      "focus-ring": "rgba(255, 224, 102, 0.7)",
      shadow: "none",
    },
    scene: {
      kind: "none",
      colors: ["#000000", "#000000", "#000000"],
      opacity: 0,
    },
    effects: {
      confetti: ["#ffe066", "#66d9e8", "#ff8a8a"],
      spotlight: "#ffe066",
    },
  },
];

const THEME_MAP = new Map<ThemeId, ThemeDef>(THEMES.map((theme) => [theme.id, theme]));

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === "string" && THEME_MAP.has(value as ThemeId);
}

export function getTheme(id: ThemeId): ThemeDef {
  return THEME_MAP.get(id) ?? THEME_MAP.get("abyss")!;
}

export const DEFAULT_PAIR: ThemePair = { dark: "abyss", light: "mist" };

export function readThemePref(storage: Storage): ThemePref {
  try {
    const raw = storage.getItem(THEME_KEY);
    if (isThemeId(raw)) return raw;
    if (raw !== null) return "auto";

    const legacy = storage.getItem(LEGACY_THEME_KEY);
    if (legacy === "dark") return "abyss";
    if (legacy === "light") return "mist";
  } catch {
    // 存储不可用时按跟随系统处理
  }
  return "auto";
}

export function writeThemePref(storage: Storage, pref: ThemePref): void {
  try {
    storage.setItem(THEME_KEY, pref);
  } catch {
    // 主题记忆失败不影响当前会话
  }
}

export function readThemePair(storage: Storage): ThemePair {
  try {
    const raw = storage.getItem(THEME_PAIR_KEY);
    if (!raw) return DEFAULT_PAIR;

    const parsed = JSON.parse(raw) as Partial<ThemePair>;
    const dark = isThemeId(parsed.dark) && getTheme(parsed.dark).mode === "dark" ? parsed.dark : DEFAULT_PAIR.dark;
    const light = isThemeId(parsed.light) && getTheme(parsed.light).mode === "light" ? parsed.light : DEFAULT_PAIR.light;
    return { dark, light };
  } catch {
    return DEFAULT_PAIR;
  }
}

export function writeThemePair(storage: Storage, pair: ThemePair): void {
  try {
    storage.setItem(THEME_PAIR_KEY, JSON.stringify(pair));
  } catch {
    // 忽略写入失败
  }
}

export function resolveThemeId(
  pref: ThemePref,
  systemPrefersDark: boolean,
  pair: ThemePair,
): ThemeId {
  if (pref !== "auto") return pref;
  return systemPrefersDark ? pair.dark : pair.light;
}

/** 一键明暗切换：切到上次使用的对侧主题，并记住当前主题。 */
export function toggleTheme(
  current: ThemeId,
  pair: ThemePair,
): { theme: ThemeId; pair: ThemePair } {
  const currentMode = getTheme(current).mode;

  if (currentMode === "dark") {
    return {
      theme: pair.light,
      pair: { dark: current, light: pair.light },
    };
  }

  return {
    theme: pair.dark,
    pair: { dark: pair.dark, light: current },
  };
}

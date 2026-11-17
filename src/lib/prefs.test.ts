import { describe, expect, it } from "vitest";
import {
  MOTION_KEY,
  readMotionPref,
  resolveReducedMotion,
  writeMotionPref,
} from "./prefs";

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

describe("readMotionPref", () => {
  it("defaults to system when nothing is stored", () => {
    expect(readMotionPref(mem())).toBe("system");
  });

  it("reads a stored preference", () => {
    expect(readMotionPref(mem({ [MOTION_KEY]: "reduced" }))).toBe("reduced");
    expect(readMotionPref(mem({ [MOTION_KEY]: "full" }))).toBe("full");
  });

  it("falls back to system for unknown or unreadable values", () => {
    expect(readMotionPref(mem({ [MOTION_KEY]: "party" }))).toBe("system");

    const broken = mem();
    broken.getItem = () => {
      throw new Error("SecurityError");
    };
    expect(readMotionPref(broken)).toBe("system");
  });
});

describe("writeMotionPref", () => {
  it("round-trips through storage", () => {
    const storage = mem();

    writeMotionPref(storage, "reduced");

    expect(storage.map.get(MOTION_KEY)).toBe("reduced");
    expect(readMotionPref(storage)).toBe("reduced");
  });

  it("does not throw when storage is unavailable", () => {
    const broken = mem();
    broken.setItem = () => {
      throw new Error("QuotaExceededError");
    };

    expect(() => writeMotionPref(broken, "full")).not.toThrow();
  });
});

describe("resolveReducedMotion", () => {
  it("follows the system preference when set to system", () => {
    expect(resolveReducedMotion("system", true)).toBe(true);
    expect(resolveReducedMotion("system", false)).toBe(false);
  });

  it("forces reduced or full regardless of the system", () => {
    expect(resolveReducedMotion("reduced", false)).toBe(true);
    expect(resolveReducedMotion("full", true)).toBe(false);
  });
});

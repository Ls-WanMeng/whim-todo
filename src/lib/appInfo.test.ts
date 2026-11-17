import { describe, expect, it } from "vitest";
import pkg from "../../package.json";
import { APP_VERSION } from "./appInfo";

describe("APP_VERSION", () => {
  it("stays in sync with package.json", () => {
    expect(APP_VERSION).toBe(pkg.version);
  });
});

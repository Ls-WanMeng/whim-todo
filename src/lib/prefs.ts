export const MOTION_KEY = "whim-todo:motion";

export type MotionPref = "system" | "reduced" | "full";

export function isMotionPref(value: unknown): value is MotionPref {
  return value === "system" || value === "reduced" || value === "full";
}

/** 读取动效偏好，缺失或非法值一律回落到「跟随系统」。 */
export function readMotionPref(storage: Storage): MotionPref {
  try {
    const raw = storage.getItem(MOTION_KEY);
    return isMotionPref(raw) ? raw : "system";
  } catch {
    return "system";
  }
}

export function writeMotionPref(storage: Storage, pref: MotionPref): void {
  try {
    storage.setItem(MOTION_KEY, pref);
  } catch {
    // 偏好写入失败不影响当前页面使用
  }
}

/** 把「偏好 + 系统设置」折算成最终是否精简动效。 */
export function resolveReducedMotion(
  pref: MotionPref,
  systemReduced: boolean,
): boolean {
  if (pref === "reduced") return true;
  if (pref === "full") return false;
  return systemReduced;
}

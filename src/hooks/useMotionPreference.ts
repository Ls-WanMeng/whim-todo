import { useCallback, useState } from "react";
import { readMotionPref, resolveReducedMotion, writeMotionPref } from "../lib/prefs";
import type { MotionPref } from "../lib/prefs";
import { useReducedMotion } from "./useReducedMotion";

/** 动效偏好：跟随系统 / 精简 / 全开，最终折算成是否精简动效。 */
export function useMotionPreference() {
  const [pref, setPrefState] = useState<MotionPref>(() => readMotionPref(window.localStorage));
  const systemReduced = useReducedMotion();

  const setPref = useCallback((next: MotionPref) => {
    setPrefState(next);
    writeMotionPref(window.localStorage, next);
  }, []);

  return { pref, setPref, reduced: resolveReducedMotion(pref, systemReduced) };
}

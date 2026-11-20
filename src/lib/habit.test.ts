import { describe, expect, it } from "vitest";
import {
  HABIT_STORAGE_KEY,
  HABIT_SCHEMA_VERSION,
  MAX_HABIT_NAME_LENGTH,
  createHabit,
  habitOverview,
  habitStreak,
  isCheckedOn,
  monthCheckedCount,
  normalizeHabit,
  readHabits,
  removeHabit,
  renameHabit,
  toggleCheckin,
  weekCheckedCount,
  writeHabits,
} from "./habit";
import type { Habit } from "./habit";

const NOW = new Date(2026, 10, 20, 12, 0, 0).getTime(); // 2026-11-20 周五 12:00

function at(month: number, day: number, hour = 12): number {
  return new Date(2026, month - 1, day, hour, 0, 0).getTime();
}

function habitWith(checkins: number[]): Habit {
  return {
    id: "h1",
    name: "晨跑",
    createdAt: at(11, 1),
    checkins,
  };
}

function makeStorage(): Storage {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
    key: (i: number) => [...map.keys()][i] ?? null,
    get length() {
      return map.size;
    },
  };
}

describe("createHabit", () => {
  it("创建带唯一 id 和空打卡记录的习惯", () => {
    const habit = createHabit("  晨跑  ", NOW);
    expect(habit.id.length).toBeGreaterThan(0);
    expect(habit.name).toBe("晨跑");
    expect(habit.createdAt).toBe(NOW);
    expect(habit.checkins).toEqual([]);
  });

  it("名字超长被截断", () => {
    const long = "早".repeat(MAX_HABIT_NAME_LENGTH + 10);
    expect(createHabit(long, NOW).name.length).toBe(MAX_HABIT_NAME_LENGTH);
  });
});

describe("toggleCheckin / isCheckedOn", () => {
  it("打卡当天，再点取消", () => {
    const day = at(11, 20);
    const checked = toggleCheckin(habitWith([]), day);
    expect(isCheckedOn(checked, day)).toBe(true);
    const unchecked = toggleCheckin(checked, day);
    expect(isCheckedOn(unchecked, day)).toBe(false);
  });

  it("任意时刻都归一到当天 00:00", () => {
    const habit = toggleCheckin(habitWith([]), at(11, 20, 23));
    expect(isCheckedOn(habit, at(11, 20, 1))).toBe(true);
    expect(habit.checkins[0]).toBe(new Date(2026, 10, 20, 0, 0, 0).getTime());
  });

  it("不改入参", () => {
    const habit = habitWith([]);
    toggleCheckin(habit, NOW);
    expect(habit.checkins).toEqual([]);
  });
});

describe("habitStreak", () => {
  it("空打卡为 0", () => {
    expect(habitStreak(habitWith([]), NOW)).toBe(0);
  });

  it("今天打卡往回连续数", () => {
    const habit = habitWith([at(11, 20), at(11, 19), at(11, 18)]);
    expect(habitStreak(habit, NOW)).toBe(3);
  });

  it("今天没打但昨天打了，从昨天起算不断签", () => {
    const habit = habitWith([at(11, 19), at(11, 18)]);
    expect(habitStreak(habit, NOW)).toBe(2);
  });

  it("今天和昨天都没打则断签", () => {
    const habit = habitWith([at(11, 17), at(11, 16)]);
    expect(habitStreak(habit, NOW)).toBe(0);
  });
});

describe("weekCheckedCount / monthCheckedCount", () => {
  it("本周打卡天数（周一起算）", () => {
    // 2026-11-20 是周五，本周周一 11-16 到周日 11-22
    const habit = habitWith([at(11, 15), at(11, 16), at(11, 18), at(11, 23)]);
    expect(weekCheckedCount(habit, NOW)).toBe(2); // 只算 16、18
  });

  it("本月打卡天数", () => {
    const habit = habitWith([at(11, 1), at(11, 20), at(10, 31)]);
    expect(monthCheckedCount(habit, NOW)).toBe(2);
  });
});

describe("habitOverview", () => {
  it("汇总总数 / 最佳连续 / 今日已打卡", () => {
    const habits = [
      habitWith([at(11, 20), at(11, 19)]),
      habitWith([at(11, 20)]),
      habitWith([]),
    ];
    const overview = habitOverview(habits, NOW);
    expect(overview.total).toBe(3);
    expect(overview.bestStreak).toBe(2);
    expect(overview.checkedToday).toBe(2);
  });
});

describe("renameHabit / removeHabit", () => {
  it("改名，空名不变", () => {
    const habit = habitWith([]);
    expect(renameHabit(habit, "夜跑").name).toBe("夜跑");
    expect(renameHabit(habit, "   ").name).toBe("晨跑");
  });

  it("删除习惯", () => {
    const habits = [habitWith([]), { ...habitWith([]), id: "h2", name: "阅读" }];
    expect(removeHabit(habits, "h1").map((h) => h.id)).toEqual(["h2"]);
  });
});

describe("normalizeHabit", () => {
  it("非法输入返回 null", () => {
    expect(normalizeHabit(null)).toBeNull();
    expect(normalizeHabit({})).toBeNull();
    expect(normalizeHabit({ id: "x", name: "  " })).toBeNull();
  });

  it("checkins 去重、归一并升序", () => {
    const habit = normalizeHabit({
      id: "h1",
      name: "晨跑",
      createdAt: NOW,
      checkins: [at(11, 20, 23), at(11, 18), at(11, 20, 1)],
    });
    expect(habit).not.toBeNull();
    expect(habit!.checkins.length).toBe(2);
    expect(habit!.checkins[0]).toBeLessThan(habit!.checkins[1]);
  });
});

describe("readHabits / writeHabits", () => {
  it("空存储返回 empty", () => {
    const result = readHabits(makeStorage());
    expect(result.status).toBe("empty");
    expect(result.habits).toEqual([]);
  });

  it("写入后读回，坏 JSON 降级 corrupt", () => {
    const storage = makeStorage();
    const habit = createHabit("晨跑", NOW);
    expect(writeHabits(storage, [habit])).toBe(true);

    const result = readHabits(storage);
    expect(result.status).toBe("ok");
    expect(result.habits).toHaveLength(1);
    expect(result.habits[0].name).toBe("晨跑");

    storage.setItem(HABIT_STORAGE_KEY, "{not json");
    const corrupt = readHabits(storage);
    expect(corrupt.status).toBe("corrupt");
    expect(corrupt.habits).toEqual([]);
  });

  it("写入结构带版本号", () => {
    const storage = makeStorage();
    writeHabits(storage, []);
    const raw = JSON.parse(storage.getItem(HABIT_STORAGE_KEY)!);
    expect(raw.version).toBe(HABIT_SCHEMA_VERSION);
  });
});

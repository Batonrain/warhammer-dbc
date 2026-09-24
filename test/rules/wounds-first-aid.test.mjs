// test/rules/wounds-first-aid.test.mjs
// wdbc-x1nz.2.103: счётчик «потеряно Ран после прошлой Первой Помощи».

import { describe, it, expect } from "vitest";
import { lostSinceFirstAidAfter } from "../../module/rules/wounds.mjs";

describe("lostSinceFirstAidAfter", () => {
  it("растёт на потерю Ран, включая уход в Критические", () => {
    expect(lostSinceFirstAidAfter(0, { value: 3, critical: 0 }, { value: 0, critical: 2 })).toBe(5);
  });
  it("лечение не уменьшает счётчик — undefined, не трогать", () => {
    expect(lostSinceFirstAidAfter(4, { value: 3, critical: 0 }, { value: 6, critical: 0 })).toBeUndefined();
  });
  it("помощь ещё не оказывали (null) — не ведётся", () => {
    expect(lostSinceFirstAidAfter(null, { value: 5, critical: 0 }, { value: 1, critical: 0 })).toBeUndefined();
  });
});

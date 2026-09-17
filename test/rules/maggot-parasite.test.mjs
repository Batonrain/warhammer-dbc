// test/rules/maggot-parasite.test.mjs
import { describe, it, expect } from "vitest";
import {
  parasiteHostUpdate, scheduleAbandonedHostDeath, isAbandonedHostDeathReady,
  ABANDONED_HOST_DEATH_DURATION, HOST_CHAR_VALUE, HOST_WOUNDS_MAX
} from "../../module/rules/maggot-parasite.mjs";

describe("parasiteHostUpdate", () => {
  it("S/T/A → 10, Раны.max → 7", () => {
    expect(parasiteHostUpdate()).toEqual({
      "system.characteristics.s.value": HOST_CHAR_VALUE,
      "system.characteristics.t.value": HOST_CHAR_VALUE,
      "system.characteristics.a.value": HOST_CHAR_VALUE,
      "system.wounds.max": HOST_WOUNDS_MAX
    });
  });
});

describe("scheduleAbandonedHostDeath / isAbandonedHostDeathReady", () => {
  it("дедлайн — +7ч от текущего worldTime", () => {
    expect(scheduleAbandonedHostDeath(1000)).toBe(1000 + ABANDONED_HOST_DEATH_DURATION);
  });
  it("готово — ровно на дедлайне и позже", () => {
    expect(isAbandonedHostDeathReady(1000, 999)).toBe(false);
    expect(isAbandonedHostDeathReady(1000, 1000)).toBe(true);
    expect(isAbandonedHostDeathReady(1000, 5000)).toBe(true);
  });
  it("нет дедлайна — не готово, не падает", () => {
    expect(isAbandonedHostDeathReady(null, 999999)).toBe(false);
    expect(isAbandonedHostDeathReady(undefined, 999999)).toBe(false);
  });
});

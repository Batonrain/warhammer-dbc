// test/rules/dodge-advantage.test.mjs
//
// Dancing Among The Fire / Танец Среди Огня (wdbc-u0by): Преимущество на
// физическое Избегание (Уклонение/Парирование) против Короткой/Длинной
// Очереди — только оба условия сразу.

import { describe, it, expect } from "vitest";
import { danceOfFireAdvantage } from "../../module/rules/dodge-advantage.mjs";

const actorWith = (...talentNames) => ({
  items: talentNames.map(name => ({ type: "talent", name }))
});

describe("danceOfFireAdvantage", () => {
  const dancer = actorWith("Dancing Among The Fire / Танец Среди Огня");

  it("Талант + Очередь — Преимущество", () => {
    expect(danceOfFireAdvantage(dancer, true)).toBe(true);
  });
  it("Талант, но не Очередь — нет", () => {
    expect(danceOfFireAdvantage(dancer, false)).toBe(false);
  });
  it("Очередь, но нет Таланта — нет", () => {
    expect(danceOfFireAdvantage(actorWith("Dodge"), true)).toBe(false);
  });
});

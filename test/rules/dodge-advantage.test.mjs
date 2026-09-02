// test/rules/dodge-advantage.test.mjs
//
// Dancing Among The Fire / Танец Среди Огня (wdbc-u0by): Преимущество на
// физическое Избегание (Уклонение/Парирование) против Короткой/Длинной
// Очереди — только оба условия сразу.

import { describe, it, expect } from "vitest";
import { hasDancingAmongTheFire, danceOfFireAdvantage } from "../../module/rules/dodge-advantage.mjs";

const actorWith = (...talentNames) => ({
  items: talentNames.map(name => ({ type: "talent", name }))
});

describe("hasDancingAmongTheFire", () => {
  it("находит по билингвальному имени", () => {
    expect(hasDancingAmongTheFire(actorWith("Dancing Among The Fire / Танец Среди Огня"))).toBe(true);
  });
  it("нет Таланта — false", () => {
    expect(hasDancingAmongTheFire(actorWith("Dodge"))).toBe(false);
  });
  it("нет актора — false, не падает", () => {
    expect(hasDancingAmongTheFire(null)).toBe(false);
  });
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

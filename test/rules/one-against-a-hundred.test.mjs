// test/rules/one-against-a-hundred.test.mjs
//
// One Against A Hundred / Один Против Сотни (wdbc-u0by): Преимущество на
// тесты против Орды (Низшие Миньоны не смоделированы — нет поля «тир» на
// акторе миньона, см. комментарий в module/rules/one-against-a-hundred.mjs).

import { describe, it, expect } from "vitest";
import { hasOneAgainstAHundred, oneAgainstAHundredAdvantage } from "../../module/rules/one-against-a-hundred.mjs";

const actorWith = (...talentNames) => ({
  items: talentNames.map(name => ({ type: "talent", name }))
});

describe("hasOneAgainstAHundred", () => {
  it("находит по билингвальному имени", () => {
    expect(hasOneAgainstAHundred(actorWith("One Against A Hundred / Один Против Сотни"))).toBe(true);
  });
  it("нет Таланта — false", () => {
    expect(hasOneAgainstAHundred(actorWith("Dodge"))).toBe(false);
  });
  it("нет актора — false, не падает", () => {
    expect(hasOneAgainstAHundred(null)).toBe(false);
  });
});

describe("oneAgainstAHundredAdvantage", () => {
  const bladeHost = actorWith("One Against A Hundred / Один Против Сотни");

  it("Талант + противник Орда — Преимущество", () => {
    expect(oneAgainstAHundredAdvantage(bladeHost, true)).toBe(true);
  });
  it("Талант, но противник не Орда — нет", () => {
    expect(oneAgainstAHundredAdvantage(bladeHost, false)).toBe(false);
  });
  it("противник Орда, но нет Таланта — нет", () => {
    expect(oneAgainstAHundredAdvantage(actorWith("Dodge"), true)).toBe(false);
  });
});

// test/rules/dominator.test.mjs

import "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach } from "vitest";
import { hasDominator, isOwnArmiger } from "../../module/rules/dominator.mjs";

const actorWith = (...talentNames) => ({
  items: talentNames.map(name => ({ type: "talent", name }))
});

describe("hasDominator", () => {
  it("находит по билингвальному имени", () => {
    expect(hasDominator(actorWith("Dominator / Покоритель"))).toBe(true);
  });
  it("нет Таланта — false", () => {
    expect(hasDominator(actorWith("Erudite-Infernal"))).toBe(false);
  });
  it("нет актора — false, не падает", () => {
    expect(hasDominator(null)).toBe(false);
  });
});

// wdbc-1rno, шаг E: Инфернальный Оруженосец — «автоматически побеждает во
// всех тестах Владычества против него». Своё, не любой купленный Миньон.
describe("isOwnArmiger", () => {
  const master = { uuid: "Actor.master" };
  const daemon = (over = {}) => ({
    uuid: "Actor.d1", name: "Bloodletter / Кровопускатель",
    system: { masterUuid: "Actor.master" },
    getFlag: (_s, k) => (k === "armigerBound" ? true : undefined),
    ...over
  });

  beforeEach(() => { globalThis.game.actors = []; });

  it("свой Оруженосец, точное совпадение по русской части имени — true", () => {
    globalThis.game.actors = [daemon()];
    expect(isOwnArmiger(master, "Кровопускатель")).toBe(true);
  });

  it("совпадение без учёта регистра", () => {
    globalThis.game.actors = [daemon()];
    expect(isOwnArmiger(master, "кровопускатель")).toBe(true);
  });

  it("демон другого Хозяина — false", () => {
    globalThis.game.actors = [daemon({ system: { masterUuid: "Actor.other" } })];
    expect(isOwnArmiger(master, "Кровопускатель")).toBe(false);
  });

  it("Миньон без флага armigerBound (куплен Талантом, не этим ритуалом) — false", () => {
    globalThis.game.actors = [daemon({ getFlag: () => undefined })];
    expect(isOwnArmiger(master, "Кровопускатель")).toBe(false);
  });

  it("имя не совпадает — false", () => {
    globalThis.game.actors = [daemon()];
    expect(isOwnArmiger(master, "Чумонос")).toBe(false);
  });

  it("пустое имя или нет актора — false, не падает", () => {
    expect(isOwnArmiger(master, "")).toBe(false);
    expect(isOwnArmiger(null, "Кровопускатель")).toBe(false);
  });
});

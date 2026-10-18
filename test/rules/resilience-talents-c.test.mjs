// test/rules/resilience-talents-c.test.mjs
//
// Таланты Стойкости (глава 3, пакет C), чистая логика без Foundry:
//   Стальная Челюсть (T+0 против Оглушения), Стена (S+0 против падения, ответный сбив на 5+),
//   Боль — Лишь Иллюзия (уровень эффекта − Успехи, минимум 1), Крепкий Орешек
//   (два броска Кровотечения, лучший), тест «смерть от шока» (разбор крит-строк).

import { describe, it, expect } from "vitest";
import {
  STATUS_RESIST, statusResistFor, stonewallKnockBack, STONEWALL_KNOCKBACK_SUCCESSES,
  painIllusionLevel, bleedingRollCount, bestBleedingRoll, FINAL_PUSH_CHAR, PAIN_ILLUSION_CHAR,
  hasResilienceTalent
} from "../../module/rules/resilience-talents.mjs";

const talent = name => ({ type: "talent", name, system: {}, flags: {} });
const actorWith = (...names) => ({ items: names.map(talent) });

describe("Стальная Челюсть и Стена: какое Состояние чем гасится", () => {
  it("Оглушение — тест T+0 Стальной Челюсти, падение — тест S+0 Стены", () => {
    expect(STATUS_RESIST.stunned).toMatchObject({ talent: "ironJaw", char: "t" });
    expect(STATUS_RESIST.prone).toMatchObject({ talent: "stonewall", char: "s" });
  });

  it("правило есть только у носителя нужного Таланта", () => {
    expect(statusResistFor(actorWith("Iron Jaw / Стальная Челюсть"), "stunned")?.talent).toBe("ironJaw");
    expect(statusResistFor(actorWith("Stonewall / Стена"), "prone")?.talent).toBe("stonewall");
    // Челюсть не помогает от падения, Стена — от Оглушения
    expect(statusResistFor(actorWith("Iron Jaw / Стальная Челюсть"), "prone")).toBeNull();
    expect(statusResistFor(actorWith("Stonewall / Стена"), "stunned")).toBeNull();
    expect(statusResistFor(actorWith(), "stunned")).toBeNull();
  });

  it("прочие Состояния Талантами не гасятся", () => {
    const a = actorWith("Iron Jaw / Стальная Челюсть", "Stonewall / Стена");
    for (const key of ["bleeding", "pinned", "burning", "dazed", "unconscious"]) expect(statusResistFor(a, key)).toBeNull();
  });

  it("Талант опознаётся и по записи Конструктора (capability), а не только по имени", () => {
    const a = { items: [{ type: "talent", name: "Что-то", system: {}, flags: { "warhammer-dbc": { mechanics: [
      { entries: [{ kind: "capability", capabilityKey: "resilience.core.ironJaw" }] }] } } }] };
    expect(hasResilienceTalent(a, "ironJaw")).toBe(true);
  });
});

describe("Стена: ответный сбив нападающего", () => {
  it("нужны 5+ Успехов, рукопашный приём и известный нападающий", () => {
    expect(STONEWALL_KNOCKBACK_SUCCESSES).toBe(5);
    expect(stonewallKnockBack({ successes: 5, melee: true, hasAttacker: true })).toBe(true);
    expect(stonewallKnockBack({ successes: 8, melee: true, hasAttacker: true })).toBe(true);
    expect(stonewallKnockBack({ successes: 4, melee: true, hasAttacker: true })).toBe(false);
    expect(stonewallKnockBack({ successes: 6, melee: false, hasAttacker: true })).toBe(false);
    expect(stonewallKnockBack({ successes: 6, melee: true, hasAttacker: false })).toBe(false);
  });
});

describe("Боль — Лишь Иллюзия: уровень эффекта", () => {
  it("уровень падает на число Успехов, но не ниже 1", () => {
    expect(painIllusionLevel(7, 2)).toBe(5);
    expect(painIllusionLevel(7, 6)).toBe(1);
    expect(painIllusionLevel(7, 20)).toBe(1);
    expect(painIllusionLevel(1, 3)).toBe(1);
    expect(painIllusionLevel(4, 0)).toBe(4);
  });

  it("мусор не ломает: уровень меньше 1 считается единицей", () => {
    expect(painIllusionLevel(0, 2)).toBe(1);
    expect(painIllusionLevel(undefined, 1)).toBe(1);
    expect(painIllusionLevel(5, -3)).toBe(5);
  });

  it("тесты Талантов: Последний Рывок — T, Боль — Воля (wp)", () => {
    expect(FINAL_PUSH_CHAR).toBe("t");
    expect(PAIN_ILLUSION_CHAR).toBe("wp");
  });
});

describe("Крепкий Орешек: кубик Кровотечения", () => {
  it("носитель бросает дважды, остальные — один раз", () => {
    expect(bleedingRollCount(actorWith("Die Hard / Крепкий Орешек"))).toBe(2);
    expect(bleedingRollCount(actorWith())).toBe(1);
  });

  it("лучший бросок Кровотечения — БОЛЬШИЙ (≤0 после Обескровливания — смерть)", () => {
    expect(bestBleedingRoll([3, 8])).toBe(8);
    expect(bestBleedingRoll([9, 2])).toBe(9);
    expect(bestBleedingRoll([5, 5])).toBe(5);
    expect(bestBleedingRoll([])).toBe(0);
  });
});

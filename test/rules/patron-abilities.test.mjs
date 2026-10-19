// test/rules/patron-abilities.test.mjs
//
// «Атака Ненависти» (Кхорн) и «Сладкое Страдание» (Слаанеш), корбук 438 —
// сверка «Покровительство», 04.10.2026. Проверяется чистая часть: когда
// способность доступна и какие эффекты Критического Эффекта она гасит. Кнопки,
// трату Очка и бросок проверяют живьём.

import { describe, it, expect } from "vitest";
import { khornePatron, hateAttackApplies, sweetSufferingApplies,
  sweetSufferingIgnores, SWEET_SUFFERING_KEPT, HATE_ATTACK_CHARS }
  from "../../module/rules/patron-abilities.mjs";
import { LIMB_LOSS_KEYS } from "../../module/rules/limb-loss.mjs";

const actor = (patronGod, alignment = "heretic") => ({ system: { alignment, patronGod } });

describe("Атака Ненависти: кому и на что", () => {
  it("только Хаосит с Покровительством Кхорна", () => {
    expect(khornePatron(actor("khorne"))).toBe(true);
    expect(khornePatron(actor("slaanesh"))).toBe(false);
    expect(khornePatron(actor("undivided"))).toBe(false);
    // Без Бога у Хаосита — Неделимый, не Кхорн.
    expect(khornePatron(actor(""))).toBe(false);
  });

  it("не-Хаосит способности не получает, даже с полем patronGod", () => {
    expect(khornePatron(actor("khorne", "loyalist"))).toBe(false);
    expect(khornePatron(null)).toBe(false);
    expect(khornePatron({})).toBe(false);
  });

  it("действует только на тест WS или BS", () => {
    expect(HATE_ATTACK_CHARS).toEqual(["ws", "bs"]);
    expect(hateAttackApplies("ws")).toBe(true);
    expect(hateAttackApplies("BS")).toBe(true);
    expect(hateAttackApplies("wp")).toBe(false);
    expect(hateAttackApplies(undefined)).toBe(false);
  });
});

describe("Сладкое Страдание: кому", () => {
  it("только Хаосит с Покровительством Слаанеш", () => {
    expect(sweetSufferingApplies(actor("slaanesh"))).toBe(true);
    expect(sweetSufferingApplies(actor("khorne"))).toBe(false);
    expect(sweetSufferingApplies(actor("slaanesh", "loyalist"))).toBe(false);
  });
});

describe("Сладкое Страдание: что игнорируется", () => {
  it("потеря конечностей и Оглушение остаются", () => {
    for (const k of LIMB_LOSS_KEYS) expect(sweetSufferingIgnores(k, [k]), k).toBe(false);
    expect(sweetSufferingIgnores("stunned", ["stunned"])).toBe(false);
    expect([...SWEET_SUFFERING_KEPT].sort()).toEqual([...LIMB_LOSS_KEYS, "stunned"].sort());
  });

  it("всё остальное гасится", () => {
    for (const k of ["fatigued", "blinded", "burning", "prone", "unconscious", "helpless",
      "deafened", "suffocating", "haemorrhaging", "uselessArm", "uselessLeg", "gangrene"])
      expect(sweetSufferingIgnores(k, [k]), k).toBe(true);
  });

  it("Кровотечение при потере конечности остаётся: оно её следствие", () => {
    // Парсер кладёт Кровотечение парой к потере (книга: потеря конечности
    // ВСЕГДА приводит к Кровотечению).
    expect(sweetSufferingIgnores("bleeding", ["lostHands", "bleeding"])).toBe(false);
    expect(sweetSufferingIgnores("bleeding", ["lostLegs", "bleeding", "stunned"])).toBe(false);
  });

  it("одиночное Кровотечение без потери конечности гасится", () => {
    expect(sweetSufferingIgnores("bleeding", ["bleeding"])).toBe(true);
    expect(sweetSufferingIgnores("bleeding", ["bleeding", "fatigued"])).toBe(true);
  });
});

// test/rules/replicant.test.mjs
//
// Черты Репликанта (сверка главы I с книгой, 26.09.2026): арифметика
// rules/replicant.mjs, правило Гипно-Шрамов, порог Усталости «Стойкого»,
// блок восстановления S/T при просроченной сыворотке и данные пака — что каждая
// Черта действительно несёт свою возможность, а раса выдаёт все Черты книги.

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import {
  ALCHEM_MONSTER, ENDURING, HYPNO_SCARS, SERUM_HOOK, EXPIRATION_DATE, GENETIC_DECAY,
  alchemDurationFactor, alchemDoseLimit, mustRerollSuccess, isIntTest, hypnoScarsStun,
  serumOverdue, serumTicksBetween, serumStatusLabel, serumHookRules, SERUM_PERIOD, SERUM_TICK,
  mutationCountNoGifts, geneticDecayBonus, replicantMaxAge, traitWithKey
} from "../../module/rules/replicant.mjs";
import { REPLICANT_RULES } from "../../module/rules/library/replicant.mjs";
import { collectRules } from "../../module/rules/collect.mjs";
import { critModsFromRules } from "../../module/rules/resolve-test.mjs";
import { fatigueGraceForActor } from "../../module/rules/fatigue-grace.mjs";
import { itemHasKey } from "../../module/rules/item-marker.mjs";
import { isKnownCapability } from "../../module/constants/capabilities.mjs";
import { allPackDocuments } from "../support/pack-docs.mjs";
import "../../module/rules/sources.mjs";

const traitsById = new Map(allPackDocuments("traits").map(({ doc }) => [doc._id, doc]));
const TRAIT = {
  alchem: "EbRb8Aso4OS3mMQ2", enduring: "AtKpwpex9sEgypxL", hulking: "2JxSkBO4Plq90YKi",
  hypno: "Si35ElTYzNkcovw5", serum: "BEIaNeHyHLjqRsUM", expiration: "ZOw54CxnCkaULMU1", decay: "s88qmAjylqfRunf9"
};

/** Черта «на акторе» — литерал с flags, как у пака. */
const traitItem = (id, extraFlags = {}) => {
  const doc = structuredClone(traitsById.get(id));
  doc.flags["warhammer-dbc"] = { ...doc.flags["warhammer-dbc"], ...extraFlags };
  return { ...doc, id: doc._id, getFlag: (s, k) => doc.flags?.[s]?.[k] };
};
const actor = (items, system = {}) => ({ items, system: { race: "replicant", characteristics: {}, ...system } });

describe("Alchem Monster / Алхимическое Чудовище", () => {
  it("длительность ×2 только у Наркотиков и Ядов и только у носителя", () => {
    expect(alchemDurationFactor("narcotic", true)).toBe(2);
    expect(alchemDurationFactor("poison", true)).toBe(2);
    expect(alchemDurationFactor("medicine", true)).toBe(1);
    expect(alchemDurationFactor("narcotic", false)).toBe(1);
  });
  it("недельный лимит доз ×2", () => {
    expect(alchemDoseLimit(3, true)).toBe(6);
    expect(alchemDoseLimit(3, false)).toBe(3);
  });
  it("перебрасывается только успех и только один раз", () => {
    expect(mustRerollSuccess(true, true)).toBe(true);
    expect(mustRerollSuccess(false, true)).toBe(false);
    expect(mustRerollSuccess(true, false)).toBe(false);
    expect(mustRerollSuccess(true, true, true)).toBe(false);
  });
});

describe("Hypno-Scars / Гипно-Шрамы", () => {
  it("тест I — Характеристика или Навык на Интеллекте, не атака", () => {
    expect(isIntTest({ kind: "skill", char: "int" })).toBe(true);
    expect(isIntTest({ kind: "skill", char: "int", skill: "logic" })).toBe(true);
    expect(isIntTest({ kind: "skill", char: "per" })).toBe(false);
    expect(isIntTest({ kind: "attack", char: "int" })).toBe(false);
  });
  it("Ступор — только при Крит. Провале теста I у носителя", () => {
    expect(hypnoScarsStun({ failure: true }, { char: "int" }, true)).toBe(true);
    expect(hypnoScarsStun({ failure: false }, { char: "int" }, true)).toBe(false);
    expect(hypnoScarsStun({ failure: true }, { char: "wp" }, true)).toBe(false);
    expect(hypnoScarsStun({ failure: true }, { char: "int" }, false)).toBe(false);
  });
  it("Предел Крит. Провала тестов I — 86+ у Репликанта с Чертой", () => {
    const a = actor([traitItem(TRAIT.hypno)]);
    const rules = collectRules(a, { kind: "skill", char: "int" });
    expect(rules.map(r => r.id)).toContain("replicant.hypnoScars.critRange");
    expect(critModsFromRules(rules, { kind: "skill", char: "int" }).failExtra).toBe(10);
    // не тест I
    expect(critModsFromRules(collectRules(a, { kind: "skill", char: "per" }), { kind: "skill", char: "per" }).failExtra).toBe(0);
  });
  it("без Черты (сняли) — Предел обычный; у Человека правила нет", () => {
    expect(collectRules(actor([]), { kind: "skill", char: "int" }).map(r => r.id))
      .not.toContain("replicant.hypnoScars.critRange");
    expect(collectRules({ items: [traitItem(TRAIT.hypno)], system: { race: "human" } }, { kind: "skill", char: "int" })
      .map(r => r.id)).not.toContain("replicant.hypnoScars.critRange");
  });
  it("правило опирается на книжную цифру: «уменьшает Предел … на 10 (обычно до 86+)»", () => {
    const benefit = traitsById.get(TRAIT.hypno).system.benefit;
    expect(benefit).toMatch(/на 10 \(обычно до 86\+\)/);
    expect(REPLICANT_RULES[0].effects[0].value).toBe(10);
  });
});

describe("Enduring / Стойкий — порог Усталости = рейтинг Unnatural T", () => {
  it("рейтинг Unnatural T (4), а не Бонус Стойкости", () => {
    const unT = { type: "trait", name: "Unnatural Toughness / Сверхъестественная Стойкость (X)",
      system: { effects: { charBonusStat: "t", charBonusValue: 4 } } };
    const a = actor([traitItem(TRAIT.enduring), unT], { characteristics: { t: { bonus: 7 } } });
    expect(fatigueGraceForActor(a)).toBe(4);
  });
  it("Черта выдаёт лечение как у Космодесантника", () => {
    expect(itemHasKey(traitsById.get(TRAIT.enduring), "healing.astartes")).toBe(true);
  });
});

describe("Serum Hook / Крючок Сывороток", () => {
  const t0 = 1_000_000;
  it("просрочка — после недели", () => {
    expect(serumOverdue(t0, t0 + SERUM_PERIOD)).toBe(false);
    expect(serumOverdue(t0, t0 + SERUM_PERIOD + 1)).toBe(true);
    expect(serumOverdue(null, t0 + 10 * SERUM_PERIOD)).toBe(false);
  });
  it("урон каждые 8 ч после недели, прыжок Календаря наверстывает все тики", () => {
    const end = t0 + SERUM_PERIOD;
    expect(serumTicksBetween(t0, t0, end)).toEqual([]);
    expect(serumTicksBetween(t0, end, end + SERUM_TICK)).toEqual([end + SERUM_TICK]);
    expect(serumTicksBetween(t0, end, end + 3 * SERUM_TICK + 5)).toEqual(
      [end + SERUM_TICK, end + 2 * SERUM_TICK, end + 3 * SERUM_TICK]);
    // следующий отрезок не повторяет уже прошедший тик
    expect(serumTicksBetween(t0, end + SERUM_TICK, end + 2 * SERUM_TICK)).toEqual([end + 2 * SERUM_TICK]);
  });
  it("строка статуса", () => {
    expect(serumStatusLabel(null, t0)).toMatch(/не отмечен/);
    expect(serumStatusLabel(t0, t0)).toMatch(/^до следующей дозы/);
    expect(serumStatusLabel(t0, t0 + SERUM_PERIOD + 3600)).toMatch(/^просрочена/);
  });
  it("просрочена — восстановление S и T заблокировано правилом charRecovery", () => {
    const a = actor([traitItem(TRAIT.serum, { serumTakenAt: t0 })]);
    expect(serumHookRules(a, t0 + 1)).toEqual([]);
    const rules = serumHookRules(a, t0 + SERUM_PERIOD + 1);
    expect(rules[0].effects).toEqual([{ kind: "charRecovery", target: "s,t", mode: "block" }]);
    expect(serumHookRules(actor([]), t0 + SERUM_PERIOD * 5)).toEqual([]);
  });
});

describe("Genetic Decay / Генетическое Угасание и Срок Годности", () => {
  const mutation = { type: "mutation", system: { god: "" } };
  const gift = { type: "mutation", system: { god: "Нургл" } };
  it("считаются мутации, но не Дары Богов", () => {
    expect(mutationCountNoGifts(actor([mutation, mutation, gift]))).toBe(2);
  });
  it("+1 к урону в Характеристику за мутацию, только к ненулевому урону", () => {
    expect(geneticDecayBonus(3, 2, true)).toBe(2);
    expect(geneticDecayBonus(0, 2, true)).toBe(0);
    expect(geneticDecayBonus(3, 2, false)).toBe(0);
  });
  it("предел возраста −1 год за мутацию", () => {
    expect(replicantMaxAge(18, 2, true)).toEqual({ base: 18, decay: 2, max: 16 });
    expect(replicantMaxAge(18, 2, false)).toEqual({ base: 18, decay: 0, max: 18 });
    expect(replicantMaxAge(null, 2, true)).toBeNull();
  });
});

describe("пак: Черты Репликанта несут свои возможности", () => {
  const expectKey = { alchem: ALCHEM_MONSTER, enduring: ENDURING, hypno: HYPNO_SCARS, serum: SERUM_HOOK,
    expiration: EXPIRATION_DATE, decay: GENETIC_DECAY, hulking: "weapons.legion" };
  for (const [name, key] of Object.entries(expectKey)) {
    it(`${name} → ${key}`, () => {
      expect(isKnownCapability(key)).toBe(true);
      expect(itemHasKey(traitsById.get(TRAIT[name]), key)).toBe(true);
      expect(traitWithKey({ items: [traitItem(TRAIT[name])] }, key)).toBeTruthy();
    });
  }
  it("benefit — полный текст книги, не пересказ", () => {
    for (const id of Object.values(TRAIT)) expect(traitsById.get(id).system.benefit.length).toBeGreaterThan(150);
  });
});

describe("пак: раса Репликант против книги", () => {
  const race = allPackDocuments("races").map(d => d.doc).find(d => d.system?.key === "replicant");
  const entries = race.flags["warhammer-dbc"].mechanics.flatMap(g => g.entries);
  it("стартовые Характеристики", () => {
    expect(race.system.chars).toEqual({ ws: 25, bs: 25, s: 35, t: 35, ag: 25, int: 20, per: 20, wp: 25, fel: 25, inf: 14 });
    expect([race.system.bonusRolls, race.system.bonusPoints, race.system.charShift]).toEqual([2, 7, 2]);
  });
  it("все 12 Черт книги, с рейтингами", () => {
    const traits = entries.filter(e => e.kind === "trait").map(e => [e.sourceUuid.split(".").pop(), e.rating ?? null]);
    const ids = traits.map(t => t[0]);
    for (const id of Object.values(TRAIT)) expect(ids).toContain(id);
    expect(traits).toContainEqual(["velXSz4lSPsKETkO", 1]);    // Size (1)
    expect(traits).toContainEqual(["rSU3EzCeVbGZU8mv", 4]);    // Unnatural S (4)
    expect(traits).toContainEqual(["jY9DymS8AVjRrTsp", 4]);    // Unnatural T (4)
    expect(traits).toContainEqual(["6GnpjyaYT8IE7WIU", 10]);   // Fast Learner (10)
    expect(ids).toContain("Iqc2Fn8gX8USBY3D");                 // The Quick and The Dead
    expect(traits).toHaveLength(12);
  });
  it("Resistance (любые 2) — выбор двух специализаций при выдаче", () => {
    const res = entries.find(e => e.kind === "talent" && e.sourceUuid.endsWith("KUrEsT190BtUwtW8"));
    expect(res.specialization).toBe("любые 2");
  });
  it("снаряжение — текстом книги", () => {
    expect(race.system.gear).toBe("5 элементов Снаряжения и Инструментов до R1 из них 2 Good.Q и 1 Best.Q, Vox-Bead");
  });
});

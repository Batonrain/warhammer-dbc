// test/documents/resilience-talents-derived.test.mjs
//
// Таланты Стойкости (глава 3, пакет A) в пересчёте актора и в конвейере правил:
// Крепкое Телосложение (максимум Ран), Ментальная Стойкость (порог обморока и
// штраф Усталости), Неутомимый (штраф Усталости по характеристике), Бронник
// (+2 AP на всех участках), Сопротивление и Декаданс (+10 через реестр правил).

import "../support/foundry-stub.mjs";

import { describe, it, expect, afterEach } from "vitest";
import { WarhammerActor } from "../../module/documents/actor.mjs";
import { ACTOR_DATA_MODELS } from "../../module/data/index.mjs";
import { fatiguePenalty, attackFatigueApplies } from "../../module/rules/situational.mjs";
import { collectTestMods } from "../../module/rules/roll-mods.mjs";
import { fatigueGraceForActor } from "../../module/rules/fatigue-grace.mjs";

const talent = (name, system = {}, flags = {}) =>
  ({ id: `${name}-${Math.random()}`, name, type: "talent", system, flags, getFlag: () => undefined });
const trait = (name, system = {}) => ({ id: name, name, type: "trait", system, getFlag: () => undefined });

/** Подставной актор: схема настоящая, расчёт — настоящий prepareDerivedData. */
function characterWith({ system: over = {}, items = [], flags = {} } = {}) {
  const system = new ACTOR_DATA_MODELS.character({}).toObject();
  const merge = (dst, src) => {
    for (const [k, v] of Object.entries(src)) {
      if (v && typeof v === "object" && !Array.isArray(v) && dst[k] && typeof dst[k] === "object") merge(dst[k], v);
      else dst[k] = v;
    }
  };
  merge(system, over);
  const list = [...items];
  list.get = id => list.find(i => i.id === id) ?? null;
  const actor = {
    type: "character", name: "Подставной", system, items: list,
    flags: { "warhammer-dbc": flags }, getFlag: (_s, k) => flags[k]
  };
  WarhammerActor.prototype.prepareDerivedData.call(actor);
  return actor;
}

/** Бонусы T.b и W.b задаются через базу: расчёт актора сам считает total и bonus. */
const setChars = (t, wp, extra = {}) => ({
  characteristics: { t: { base: t * 10 + 5 }, wp: { base: wp * 10 + 5 }, ...extra }
});

afterEach(() => { delete globalThis.game.time; });

describe("Крепкое Телосложение: максимум Ран", () => {
  it("+1 за копию: три копии при T.b 4 — 12 → 15", () => {
    const a = characterWith({
      system: { wounds: { max: 12, value: 12 }, ...setChars(4, 3) },
      items: [talent("Sound Constitution / Крепкое Телосложение"), talent("Sound Constitution / Крепкое Телосложение"),
              talent("Sound Constitution / Крепкое Телосложение")]
    });
    expect(a.system.wounds.max).toBe(12);
    expect(a.system.wounds.effectiveMax).toBe(15);
    expect(a.system.wounds.maxMods.some(m => m.value === 3)).toBe(true);
  });

  it("потолок T.b+2: девять копий при T.b 4 дают +6 (человеку)", () => {
    const a = characterWith({
      system: { wounds: { max: 12, value: 12 }, ...setChars(4, 3) },
      items: Array.from({ length: 9 }, () => talent("Sound Constitution / Крепкое Телосложение"))
    });
    expect(a.system.wounds.effectiveMax).toBe(18);
  });

  it("потолок T.b для Космодесантника: те же девять копий дают +4", () => {
    const a = characterWith({
      system: { race: "astartes", wounds: { max: 12, value: 12 }, ...setChars(4, 3) },
      items: Array.from({ length: 9 }, () => talent("Sound Constitution / Крепкое Телосложение"))
    });
    expect(a.system.wounds.effectiveMax).toBe(16);
  });

  it("без Таланта максимум не меняется", () => {
    const a = characterWith({ system: { wounds: { max: 12, value: 12 }, ...setChars(4, 3) } });
    expect(a.system.wounds.effectiveMax).toBe(12);
  });
});

describe("Ментальная Стойкость: порог обморока и штрафы Усталости", () => {
  const withMF = [talent("Mental Fortitude / Ментальная Стойкость")];

  it("порог Усталости T.b+W.b без Таланта и T.b+2×W.b с ним", () => {
    expect(characterWith({ system: setChars(4, 3) }).system.fatigue.max).toBe(7);
    expect(characterWith({ system: setChars(4, 3), items: withMF }).system.fatigue.max).toBe(10);
  });

  it("запись «Усталость» Конструктора (порог W.b) — штрафа нет до W.b, с W.b+1 есть", () => {
    const mf = talent("Mental Fortitude / Ментальная Стойкость", {}, { "warhammer-dbc": { mechanics: [
      { id: "g", operator: "AND", entries: [{ id: "e", kind: "fatigue", fatigueAction: "threshold", fatigueThresholdChar: "wp" }] }
    ] } });
    const make = fatigue => characterWith({ system: { ...setChars(4, 3), fatigue: { value: fatigue } }, items: [mf] });
    expect(fatigueGraceForActor(make(3))).toBe(3);
    expect(fatiguePenalty(make(3), "ws")).toBe(0);
    expect(fatiguePenalty(make(4), "ws")).toBe(-10);
  });
});

describe("Неутомимый: штраф Усталости по характеристике теста", () => {
  const tired = items => characterWith({ system: { ...setChars(4, 3), fatigue: { value: 2 } }, items });
  const withTireless = [talent("Tireless / Неутомимый")];

  it("с Талантом: WS, BS, S, T, A без штрафа; I, P, W, F — со штрафом", () => {
    const a = tired(withTireless);
    for (const c of ["ws", "bs", "s", "t", "ag"]) expect(fatiguePenalty(a, c), c).toBe(0);
    for (const c of ["int", "per", "wp", "fel"]) expect(fatiguePenalty(a, c), c).toBe(-10);
  });

  it("без Таланта штраф −10 на WS, BS, S, A (T не касается и так)", () => {
    const a = tired([]);
    for (const c of ["ws", "bs", "s", "ag", "int"]) expect(fatiguePenalty(a, c), c).toBe(-10);
    expect(fatiguePenalty(a, "t")).toBe(0);
  });

  it("конвейер тестов: строки «Усталость» у носителя нет на A и есть на W", () => {
    const a = tired(withTireless);
    const ag = collectTestMods(a, { kind: "skill", char: "ag" });
    const wp = collectTestMods(a, { kind: "skill", char: "wp" });
    expect(ag.total).toBe(0);
    expect(wp.total).toBe(-10);
  });

  it("атака: у носителя нет штрафа Усталости и в конвейере атаки (WS/BS)", () => {
    const a = tired(withTireless);
    expect(collectTestMods(a, { kind: "attack", isMelee: true, char: "ws" }).total).toBe(0);
    expect(collectTestMods(tired([]), { kind: "attack", isMelee: true, char: "ws" }).total).toBe(-10);
  });

  it("окно атаки: галочка «Усталость −10» (attackFatigueApplies) у носителя не ставится, без Таланта — ставится", () => {
    expect(attackFatigueApplies(tired(withTireless), "ws")).toBe(false);
    expect(attackFatigueApplies(tired(withTireless), "bs")).toBe(false);
    expect(attackFatigueApplies(tired([]), "ws")).toBe(true);
    expect(attackFatigueApplies(tired([]), "bs")).toBe(true);
  });

  it("окно атаки: отдохнувший персонаж — галочки нет и без Таланта", () => {
    const rested = characterWith({ system: { ...setChars(4, 3), fatigue: { value: 0 } } });
    expect(attackFatigueApplies(rested, "ws")).toBe(false);
  });

  it("окно атаки: Ментальная Стойкость — галочка с Усталости W.b+1, не раньше", () => {
    const mf = talent("Mental Fortitude / Ментальная Стойкость", {}, { "warhammer-dbc": { mechanics: [
      { id: "g", operator: "AND", entries: [{ id: "e", kind: "fatigue", fatigueAction: "threshold", fatigueThresholdChar: "wp" }] }
    ] } });
    const make = fatigue => characterWith({ system: { ...setChars(4, 3), fatigue: { value: fatigue } }, items: [mf] });
    expect(attackFatigueApplies(make(3), "ws")).toBe(false);
    expect(attackFatigueApplies(make(4), "ws")).toBe(true);
  });
});

describe("Бронник: +2 AP на всех участках", () => {
  const DAY = 86400;
  const monger = [talent("Armour-Monger / Бронник")];
  const LOCS = ["head", "body", "leftArm", "rightArm", "leftLeg", "rightLeg"];

  it("тумблер включён в те же сутки — +2 в поглощение каждой зоны", () => {
    globalThis.game.time = { worldTime: 10 * DAY + 3600 };
    const base = characterWith({ system: setChars(4, 3), items: monger });
    const on = characterWith({ system: setChars(4, 3), items: monger, flags: { armourMonger: { day: 10 } } });
    for (const l of LOCS) {
      expect(on.system.absorption.armorOnly[l], l).toBe(base.system.absorption.armorOnly[l] + 2);
      expect(on.system.absorption[l], l).toBe(base.system.absorption[l] + 2);
    }
  });

  it("метка прошлых суток не действует (полночь прошла)", () => {
    globalThis.game.time = { worldTime: 11 * DAY };
    const base = characterWith({ system: setChars(4, 3), items: monger });
    const old = characterWith({ system: setChars(4, 3), items: monger, flags: { armourMonger: { day: 10 } } });
    for (const l of LOCS) expect(old.system.absorption.armorOnly[l], l).toBe(base.system.absorption.armorOnly[l]);
  });

  it("без Таланта метка ничего не даёт", () => {
    globalThis.game.time = { worldTime: 10 * DAY };
    const base = characterWith({ system: setChars(4, 3) });
    const flagged = characterWith({ system: setChars(4, 3), flags: { armourMonger: { day: 10 } } });
    expect(flagged.system.absorption.armorOnly.body).toBe(base.system.absorption.armorOnly.body);
  });

  it("складывается с надбавкой эффектов (system.armorBonus)", () => {
    globalThis.game.time = { worldTime: 10 * DAY };
    const a = characterWith({ system: { ...setChars(4, 3), armorBonus: { body: 3 } }, items: monger, flags: { armourMonger: { day: 10 } } });
    expect(a.system.absorption.armorOnly.body).toBe(5);
    expect(a.system.absorption.armorOnly.head).toBe(2);
  });
});

describe("Сопротивление и Декаданс: +10 через реестр правил", () => {
  const resistance = spec => talent("Resistance / Сопротивление", { specialization: spec });

  it("Страх: +10 только на тест с тегом fearTest", () => {
    const a = characterWith({ system: setChars(4, 3), items: [resistance("Fear")] });
    expect(collectTestMods(a, { kind: "skill", char: "wp", morale: true, fearTest: true }).total).toBe(10);
    expect(collectTestMods(a, { kind: "skill", char: "wp", morale: true }).total).toBe(0);
    expect(collectTestMods(a, { kind: "skill", char: "wp" }).total).toBe(0);
  });

  it("Яд, Психосилы, Оглушение — каждому свой тег", () => {
    const a = characterWith({ system: setChars(4, 3), items: [resistance("Poison, Psychic Powers, Stun")] });
    expect(collectTestMods(a, { kind: "skill", char: "t", poisonTest: true }).total).toBe(10);
    expect(collectTestMods(a, { kind: "skill", char: "wp", psychicThreat: true }).total).toBe(10);
    expect(collectTestMods(a, { kind: "skill", char: "t", stunTest: true }).total).toBe(10);
    expect(collectTestMods(a, { kind: "skill", char: "wp", fearTest: true }).total).toBe(0);
  });

  it("не выбранная специализация бонуса не даёт", () => {
    const a = characterWith({ system: setChars(4, 3), items: [resistance("Cold, Heat")] });
    expect(collectTestMods(a, { kind: "skill", char: "t", poisonTest: true }).total).toBe(0);
    expect(collectTestMods(a, { kind: "skill", char: "wp", fearTest: true }).total).toBe(0);
  });

  it("Декаданс: +10 на тест Зависимости, на прочие тесты — нет", () => {
    const a = characterWith({ system: setChars(4, 3), items: [talent("Decadence / Декаданс")] });
    expect(collectTestMods(a, { kind: "skill", char: "t", addictionTest: true }).total).toBe(10);
    expect(collectTestMods(a, { kind: "skill", char: "t" }).total).toBe(0);
  });

  it("лишний предмет-не-Талант с таким именем не считается", () => {
    const a = characterWith({ system: setChars(4, 3), items: [trait("Resistance", { specialization: "Fear" })] });
    expect(collectTestMods(a, { kind: "skill", char: "wp", fearTest: true }).total).toBe(0);
  });
});

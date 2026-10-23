// test/rules/rage.test.mjs
//
// Ярость (Frenzy / Ярость, корбук, Таланты «Берсерк», pdf-стр. 62; Sahara 3-861e).
// Числа Ярости пишутся по СОСТОЯНИЮ system.inRage, а не по Таланту: Ярость
// приходит из шести мест (Frenzy, Кхорнгор, галлюциногены, Икона Богохульства,
// Первобытный Вой, Скорый на Гнев), и у большинства Таланта Frenzy нет.
//
// Что проверяется (книга: «+10 к WS, S и W, штраф −20 на все тесты BS, I и F,
// игнорирует штраф −10 от Усталости, не может быть Оглушён, автоматически
// проходит тесты Морали»):
//   • rules/rage.mjs — числа и записи правил;
//   • характеристики в расчёте актора (rules/character.mjs);
//   • штраф −20 на тесты BS/I/F — через конвейер правил и окно атаки;
//   • Усталость, Оглушение, Мораль — три места, где Ярость уже что-то гасит.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  RAGE_CHAR_BONUS, RAGE_TEST_PENALTY, isInRage, rageCharBonus, rageRules
} from "../../module/rules/rage.mjs";
import { resolveTest } from "../../module/rules/resolve-test.mjs";
import { fatiguePenalty, attackFatigueApplies } from "../../module/rules/situational.mjs";
import { isImmuneToCondition } from "../../module/rules/condition-guards.mjs";
import { rollMoraleTest } from "../../module/rules/morale-test.mjs";
import { _executeFearRoll } from "../../module/combat/fear.mjs";
import { rollIntimidateContest } from "../../module/combat/intimidate.mjs";
import { rollFieldExecutionContest } from "../../module/combat/field-execution.mjs";
import { WarhammerActor } from "../../module/documents/actor.mjs";
import { ACTOR_DATA_MODELS } from "../../module/data/index.mjs";
import { actorFor, weaponFor } from "../support/combat-fixtures.mjs";
import { showAttackDialog } from "../../module/sheets/attack-dialog.mjs";

/** Минимальный актор для чистых правил. */
const actor = ({ inRage = false, items = [], ...system } = {}) => ({
  system: { inRage, characteristics: {}, wounds: {}, conditions: {}, ...system },
  items
});

const autoLabels = r => r.autoMods.map(m => `${m.label}:${m.value}`);

describe("Ярость: числа Базы (rules/rage.mjs)", () => {
  it("+10 к WS, S и W — и только к ним", () => {
    expect(RAGE_CHAR_BONUS).toEqual({ ws: 10, s: 10, wp: 10 });
    const raging = actor({ inRage: true });
    for (const key of ["ws", "s", "wp"]) expect(rageCharBonus(raging, key)).toBe(10);
    for (const key of ["bs", "t", "ag", "int", "per", "fel", "inf"]) expect(rageCharBonus(raging, key)).toBe(0);
  });

  it("вне Ярости характеристики не меняются", () => {
    const calm = actor({ inRage: false });
    for (const key of ["ws", "s", "wp"]) expect(rageCharBonus(calm, key)).toBe(0);
    expect(isInRage(calm)).toBe(false);
    expect(isInRage(null)).toBe(false);
  });

  it("−20 — это штраф к ТЕСТАМ, а не к значению характеристики", () => {
    expect(RAGE_TEST_PENALTY).toBe(-20);
  });

  it("записи правил: BS, I и F по −20, автоматически (без галочки)", () => {
    const rules = rageRules(actor({ inRage: true }));
    const targets = rules.flatMap(r => r.effects.map(e => e.target)).sort();
    expect(targets).toEqual(["basedon:bs", "basedon:fel", "basedon:int"]);
    for (const r of rules) {
      expect(r.effects).toHaveLength(1);
      expect(r.effects[0]).toMatchObject({ kind: "rollBonus", value: -20, auto: true });
    }
  });

  it("вне Ярости записей нет вовсе (источник вызывается на каждый тест)", () => {
    expect(rageRules(actor())).toEqual([]);
    expect(rageRules(null)).toEqual([]);
  });
});

describe("Ярость: штраф −20 на тесты BS, I и F через конвейер правил", () => {
  it("тест Интеллекта и Товарищества — −20, виден строкой", () => {
    const a = actor({ inRage: true });
    expect(autoLabels(resolveTest({ actor: a, kind: "char", char: "int" })).some(s => s.endsWith(":-20"))).toBe(true);
    expect(autoLabels(resolveTest({ actor: a, kind: "char", char: "fel" })).some(s => s.endsWith(":-20"))).toBe(true);
    expect(autoLabels(resolveTest({ actor: a, kind: "char", char: "bs" })).some(s => s.endsWith(":-20"))).toBe(true);
  });

  it("навык на Интеллекте/Товариществе тоже получает штраф (Командование, Обман)", () => {
    const a = actor({ inRage: true });
    const r = resolveTest({ actor: a, kind: "skill", skill: "command", char: "fel" });
    expect(r.autoMods.some(m => m.value === -20 && /Ярост/.test(m.label))).toBe(true);
  });

  it("тесты WS, S, W, T штрафа не получают (там +10 к значению, не штраф)", () => {
    const a = actor({ inRage: true });
    for (const char of ["ws", "s", "wp", "t", "ag", "per"]) {
      const r = resolveTest({ actor: a, kind: "char", char });
      expect(r.autoMods.some(m => /Ярост/.test(m.label)), char).toBe(false);
    }
  });

  it("не в Ярости — ни одной строки", () => {
    const a = actor({ inRage: false });
    for (const char of ["bs", "int", "fel"]) {
      expect(resolveTest({ actor: a, kind: "char", char }).autoMods.some(m => /Ярост/.test(m.label))).toBe(false);
    }
  });
});

describe("Ярость: Усталость −10 игнорируется", () => {
  const tired = (inRage) => actor({ inRage, fatigue: { value: 3 } });

  it("в Ярости штрафа Усталости нет ни на одной характеристике", () => {
    for (const char of ["ws", "bs", "ag", "int", "wp", "per", "fel"]) {
      expect(fatiguePenalty(tired(true), char), char).toBe(0);
    }
  });

  it("вне Ярости тот же уставший получает −10 (контроль)", () => {
    expect(fatiguePenalty(tired(false), "ws")).toBe(-10);
  });

  it("галочка «Усталость» в окне атаки в Ярости не нужна", () => {
    expect(attackFatigueApplies(tired(true), "ws")).toBe(false);
    expect(attackFatigueApplies(tired(false), "ws")).toBe(true);
  });
});

describe("Ярость: нельзя Оглушить", () => {
  it("в Ярости невосприимчив к Оглушению, к прочим Состояниям — нет", () => {
    const raging = actor({ inRage: true });
    expect(isImmuneToCondition(raging, "stunned")).toBe(true);
    expect(isImmuneToCondition(raging, "prone")).toBe(false);
    expect(isImmuneToCondition(raging, "bleeding")).toBe(false);
  });

  it("вне Ярости — как раньше", () => {
    expect(isImmuneToCondition(actor({ inRage: false }), "stunned")).toBe(false);
  });
});

describe("Ярость: тесты Морали проходятся автоматически", () => {
  beforeEach(resetCaptured);

  it("тест Морали (Подавление, Шок, Паника) в Ярости — успех при заведомо плохом броске", async () => {
    captured.nextRoll = 99;
    const r = await rollMoraleTest(actor({ inRage: true }), 10);
    expect(r.success).toBe(true);
    expect(r.dof).toBe(0);
    expect(r.parts.join(" ")).toMatch(/Ярост/);
  });

  it("вне Ярости тот же бросок проваливается (контроль)", async () => {
    captured.nextRoll = 99;
    const r = await rollMoraleTest(actor({ inRage: false }), 10);
    expect(r.success).toBe(false);
  });

  it("тест Страха в Ярости — «выстоял» без Infamy", async () => {
    captured.nextRoll = 99;
    const a = {
      id: "a1", name: "Берсерк", items: [],
      system: { inRage: true, characteristics: { wp: { total: 40 } }, fatigue: { value: 0, max: 0 }, fate: { value: 0 } },
      getFlag: () => undefined, update: async () => {}, effects: [], createEmbeddedDocuments: async () => []
    };
    await _executeFearRoll(a, 1, "important", 0, 0);
    expect(captured.chat.at(-1).content).toContain("выстоял");
  });
});

describe("Ярость цели: встречные тесты Морали (Запугивание, Полевая Казнь)", () => {
  const fighter = (name, { intimidate = 50, wp = 30, inRage = false } = {}) => ({
    id: name, name, uuid: `Actor.${name}`,
    system: { inRage, skills: { intimidate: { total: intimidate } }, characteristics: { wp: { total: wp } } },
    getFlag: () => undefined
  });

  beforeEach(() => {
    resetCaptured();
    globalThis.game.settings = { get: () => "publicroll" };
  });

  it("Запугивание: цель в Ярости проходит тест при заведомо плохом броске, на карточке «(Ярость)»", async () => {
    captured.dice = [95, 95];            // оба провалили бросок; у цели в Ярости — автоуспех
    const { winner } = await rollIntimidateContest(fighter("Командир"), fighter("Берсерк", { inRage: true }));
    expect(winner).toBe("theirs");
    expect(captured.chat.at(-1).content).toContain("(Ярость)");
  });

  it("Запугивание вне Ярости тот же бросок цели не спасает (контроль)", async () => {
    captured.dice = [10, 95];
    const { winner } = await rollIntimidateContest(fighter("Командир"), fighter("Цель"));
    expect(winner).toBe("mine");
    expect(captured.chat.at(-1).content).not.toContain("(Ярость)");
  });

  it("Полевая Казнь: цель в Ярости — автоуспех, исполнитель с провалом не побеждает", async () => {
    captured.dice = [95, 95];
    const { winner } = await rollFieldExecutionContest(fighter("Командир"), fighter("Берсерк", { inRage: true }));
    expect(winner).not.toBe("mine");
    expect(captured.chat.at(-1).content).toContain("Успех");
  });

  it("Полевая Казнь вне Ярости: провал цели при успехе исполнителя — казнь (контроль)", async () => {
    captured.dice = [10, 95];
    const { winner } = await rollFieldExecutionContest(fighter("Командир"), fighter("Цель"));
    expect(winner).toBe("mine");
  });
});

// ── Расчёт актора: +10 WS/S/W в характеристиках ─────────────────────────────

function derived({ base = {}, inRage = false, fatigue = 0 } = {}) {
  const system = new ACTOR_DATA_MODELS.character({}).toObject();
  for (const [k, v] of Object.entries(base)) system.characteristics[k].base = v;
  system.inRage = inRage;
  system.fatigue.value = fatigue;
  const items = [];
  items.get = () => null;
  WarhammerActor.prototype.prepareDerivedData.call({
    type: "character", name: "Подставной", system, items, getFlag: () => undefined
  });
  return system;
}

describe("Ярость в расчёте актора: +10 к значению WS, S и W", () => {
  const base = { ws: 40, bs: 40, s: 40, t: 40, ag: 40, int: 40, per: 40, wp: 40, fel: 40 };

  it("вне Ярости — база как есть", () => {
    const s = derived({ base });
    expect(s.characteristics.ws.total).toBe(40);
    expect(s.characteristics.s.total).toBe(40);
    expect(s.characteristics.wp.total).toBe(40);
  });

  it("в Ярости WS, S и W на 10 больше, Бонус растёт вместе с ними", () => {
    const calm = derived({ base });
    const rage = derived({ base, inRage: true });
    for (const k of ["ws", "s", "wp"]) {
      expect(rage.characteristics[k].total, k).toBe(50);
      expect(rage.characteristics[k].bonus, k).toBe(calm.characteristics[k].bonus + 1);
    }
  });

  it("BS, I, F и остальные в значении не меняются (минус −20 — штраф теста, не значения)", () => {
    const rage = derived({ base, inRage: true });
    for (const k of ["bs", "t", "ag", "int", "per", "fel", "inf"]) {
      expect(rage.characteristics[k].total, k).toBe(base[k] ?? rage.characteristics[k].total);
    }
    expect(rage.characteristics.bs.total).toBe(40);
    expect(rage.characteristics.int.total).toBe(40);
    expect(rage.characteristics.fel.total).toBe(40);
  });

  it("причина видна в подсказке итога: строка «Ярость» +10", () => {
    const rage = derived({ base, inRage: true });
    expect(rage.characteristics.ws.totalBreakdown).toContainEqual({ label: "Ярость", value: 10 });
    expect(derived({ base }).characteristics.ws.totalBreakdown.some(r => r.label === "Ярость")).toBe(false);
  });

  it("выход из Ярости возвращает числа (производное, не запись в базу)", () => {
    const rage = derived({ base, inRage: true });
    const calm = derived({ base, inRage: false });
    expect(rage.characteristics.ws.base).toBe(calm.characteristics.ws.base);
    expect(calm.characteristics.ws.total).toBe(40);
  });
});

// ── Окно атаки: −20 BS стрелковой атаке ─────────────────────────────────────

const html = () => captured.dialog?.content ?? "";
function modLine(label) {
  const idx = html().indexOf(`<span>${label}`);
  if (idx < 0) return null;
  const before = html().slice(Math.max(0, idx - 500), idx);
  const tag = before.slice(before.lastIndexOf("<input"));
  return {
    value: (tag.match(/data-value="(-?\d+)"/) || [])[1] ?? null,
    checked: /\schecked(\s|\/|>)/.test(tag)
  };
}

describe("Ярость: окно атаки", () => {
  const prevCanvas = globalThis.canvas;
  beforeEach(() => {
    resetCaptured();
    globalThis.canvas = { grid: { size: 1 }, tokens: { placeables: [] } };
  });
  afterEach(() => { globalThis.canvas = prevCanvas; });

  function open(weaponSys, inRage) {
    const weapon = weaponFor(weaponSys);
    const a = actorFor({ items: [weapon], fatigue: { value: 0 }, aiming: "none", inRage });
    a.type = "character"; a.uuid = "Actor.rager"; a.update = async () => {};
    showAttackDialog(a, weapon);
  }

  it("стрельба в Ярости: «Ярость: −20 BS», отмечено само", () => {
    open({ weaponClass: "basic" }, true);
    expect(modLine("Ярость: −20 BS")).toMatchObject({ value: "-20", checked: true });
  });

  it("рукопашная в Ярости: штрафа BS нет (бьёт по WS)", () => {
    open({ weaponClass: "melee" }, true);
    expect(modLine("Ярость: −20 BS")).toBeNull();
  });

  it("стрельба вне Ярости: строки нет", () => {
    open({ weaponClass: "basic" }, false);
    expect(modLine("Ярость: −20 BS")).toBeNull();
  });
});

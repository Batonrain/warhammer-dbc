// test/rules/defiance.test.mjs
//
// Defiance / Неповиновение (глава 3, «Пси-Стойкость», Sahara 3-defiance;
// DoomBC — Основная книга, packs-src/books/core.json): «Персонаж получает
// Преимущество на все встречные тесты против психосил (кроме непрямых),
// выжигания души, атак одержимостью и прочих Варп-эффектов, вызванных
// Ненавистными врагами».
//
// Раньше запись Таланта несла kind:"reroll" с областью «любой тест» и без
// условий — переброс на ЛЮБОМ броске, шире книги. Теперь это правило источника
// Ненависти (rules/hatred.mjs): область psychicThreat (тест Сопротивления
// психосиле) И цель — Ненавистная (ctx.targetActor — кастер).

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { hatredRules } from "../../module/rules/hatred.mjs";
import { resolveTest } from "../../module/rules/resolve-test.mjs";
import { raceTarget } from "../../module/rules/talent-targets.mjs";

const hatred = targets => ({ type: "talent", name: "Hatred / Ненависть", system: { targets } });
const defiance = () => ({ type: "talent", name: "Defiance / Неповиновение", system: {} });
const ork = { type: "character", system: { race: "ork" }, items: [] };
const human = { type: "character", system: { race: "human" }, items: [] };

const hated = [raceTarget("ork", "Орк")];
const withDefiance = () => ({ type: "character", system: {}, items: [hatred(hated), defiance()] });
const withoutDefiance = () => ({ type: "character", system: {}, items: [hatred(hated)] });

/** Тест Сопротивления психосиле: характеристика W, тег psychicThreat, цель — кастер. */
const resist = (caster, extra = {}) =>
  ({ kind: "skill", char: "wp", psychicThreat: true, targetActor: caster, ...extra });

describe("hatredRules: Defiance", () => {
  it("с Defiance и Ненавистным кастером даёт переброс области psychicThreat", () => {
    const rule = hatredRules(withDefiance(), resist(ork)).find(r => r.id === "hatred.defiance");
    expect(rule.effects).toEqual([{ kind: "rollMode", target: "psychicThreat", mode: "keepBest", rolls: 2, who: "self" }]);
  });

  it("без Defiance правила нет (одной Ненависти мало)", () => {
    expect(hatredRules(withoutDefiance(), resist(ork)).find(r => r.id === "hatred.defiance")).toBeUndefined();
  });

  it("кастер не из Ненавистных — правил Ненависти нет вовсе", () => {
    expect(hatredRules(withDefiance(), resist(human))).toEqual([]);
  });

  it("Непрямая сила исключена («кроме непрямых»)", () => {
    expect(hatredRules(withDefiance(), resist(ork, { psychicIndirect: true }))
      .find(r => r.id === "hatred.defiance")).toBeUndefined();
  });

  it("опознаёт Талант по русской половине имени", () => {
    const actor = { type: "character", system: {}, items: [hatred(hated),
      { type: "talent", name: "Неповиновение", system: {} }] };
    expect(hatredRules(actor, resist(ork)).some(r => r.id === "hatred.defiance")).toBe(true);
  });
});

describe("resolveTest: Defiance в конвейере", () => {
  const rerollLabels = ctx => resolveTest({ actor: withDefiance(), ...ctx }).rerolls.map(r => r.label);

  it("тест Сопротивления психосиле против Ненавистного кастера — предлагает переброс", () => {
    expect(rerollLabels(resist(ork)).length).toBe(1);
  });

  it("то же без тега psychicThreat (обычный тест Воли) — переброса нет", () => {
    expect(rerollLabels({ kind: "skill", char: "wp", targetActor: ork })).toEqual([]);
  });

  it("любой другой тест (атака, Подавление) по Ненавистной цели — переброса Defiance нет", () => {
    expect(rerollLabels({ kind: "attack", isMelee: true, targetActor: ork })).toEqual([]);
    expect(rerollLabels({ kind: "skill", char: "ag", skill: "dodge", targetActor: ork })).toEqual([]);
  });

  it("кастер не Ненавистный — переброса нет", () => {
    expect(rerollLabels(resist(human))).toEqual([]);
  });
});

describe("Defiance в паке", () => {
  const file = fs.readdirSync(path.resolve(import.meta.dirname, "../../packs-src/talents/Пси_стойкость"))
    .find(f => f.startsWith("Defiance"));
  const doc = JSON.parse(fs.readFileSync(
    path.resolve(import.meta.dirname, "../../packs-src/talents/Пси_стойкость", file), "utf8"));

  it("не несёт широкой записи «любой тест» (правило живёт в rules/hatred.mjs)", () => {
    const entries = (doc.flags["warhammer-dbc"].mechanics ?? []).flatMap(g => g.entries ?? []);
    expect(entries.filter(e => e.kind === "reroll")).toEqual([]);
  });

  it("заметка называет читателя", () => {
    expect(doc.system.notes).toContain("hatred.defiance");
  });

  it("несёт запись-возможность, читаемую rules/hatred.mjs", () => {
    const entries = (doc.flags["warhammer-dbc"].mechanics ?? []).flatMap(g => g.entries ?? []);
    expect(entries.map(e => e.capabilityKey)).toEqual(["psyResist.core.defiance"]);
  });
});

// test/combat/final-execution.test.mjs
//
// Окончательная Казнь (Мастер Казней, Талант; Sahara task-bbe1, решение владельца 27.10.2026). Текст Таланта:
// «Совершая атаку Казнью, может потратить Очко Трофеев, чтобы первая атака получила свойства Extreme(9) и
// Proven(5), а каждая следующая атака Казни — накапливающиеся −1 к рейтингу Extreme и +1 к Proven.»
// Очко Трофеев списывается ОДИН раз — на первую атаку серии (серия = Раунд боя); следующие атаки того же
// Раунда продолжают серию бесплатно. Списание — при подтверждении атаки (кнопка в окне атаки, как Смертельный
// Танец), отказ без Очка. Актор — настоящая схема + пересчёт листа, Талант — документ пака.

import "../support/foundry-stub.mjs";
import fs from "node:fs";
import path from "node:path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { WarhammerActor } from "../../module/documents/actor.mjs";
import { ACTOR_DATA_MODELS } from "../../module/data/index.mjs";
import { resolveWeaponPropsList, aggregateAuto } from "../../module/combat/weapon-properties.mjs";
import {
  hasFinalExecution, finalExecutionStep, finalExecutionProps, finalExecutionGate, commitFinalExecution,
  finalExecutionRowHtml, FINAL_EXECUTION_TEXT
} from "../../module/combat/final-execution.mjs";
import { mergeExtraProps } from "../../module/combat/attack-weapon.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");
function packDoc(dir, idTail) {
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(f => {
    const p = path.join(d, f.name);
    return f.isDirectory() ? walk(p) : (f.name.endsWith(`_${idTail}.json`) ? [p] : []);
  });
  const [file] = walk(path.join(ROOT, "packs-src", dir));
  return JSON.parse(fs.readFileSync(file, "utf8"));
}
const FINAL = () => packDoc("talents", "WVsAgRZSj7cPhzoM");

function actorWith(docs = [FINAL()], { value = 2, perBase = 40 } = {}) {
  const system = new ACTOR_DATA_MODELS.character({}).toObject();
  system.characteristics.per.base = perBase;
  system.trophyPoints.value = value;
  const items = docs.map((d, i) => ({ id: `i${i}`, name: d.name, type: d.type, system: d.system, flags: d.flags ?? {}, getFlag: () => undefined }));
  items.get = () => null;
  const store = {};
  const actor = {
    type: "character", name: "Мастер Казней", system, items,
    getFlag: (s, k) => store[k], setFlag: async (s, k, v) => { store[k] = v; }, unsetFlag: async (s, k) => { delete store[k]; },
    async update(data) {
      for (const [p, v] of Object.entries(data)) {
        const keys = p.split(".");
        let node = actor;
        for (const k of keys.slice(0, -1)) node = (node[k] ??= {});
        node[keys.at(-1)] = v;
      }
    }
  };
  WarhammerActor.prototype.prepareDerivedData.call(actor);
  return actor;
}

beforeEach(() => { globalThis.game.combat = { id: "cb", round: 1, started: true }; });
afterEach(() => { globalThis.game.combat = undefined; });

describe("данные Таланта и свойства оружия", () => {
  it("текст Таланта в паке: Extreme(9), Proven(5), −1 к Extreme и +1 к Proven за каждую следующую атаку", () => {
    const text = String(FINAL().system.benefit);
    expect(text).toContain("Extreme(9)");
    expect(text).toContain("Proven(5)");
    expect(text).toMatch(/−1 к рейтингу Extreme и \+1 к Proven/);
    expect(FINAL_EXECUTION_TEXT).toContain("Extreme(9)");
  });

  it("первая атака серии — Extreme(9)/Proven(5); дальше Extreme на 1 ниже, Proven на 1 выше; Extreme не ниже 2", () => {
    const rating = (n, key) => finalExecutionProps(n).find(p => p.key === key).rating;
    expect([0, 1, 2, 3, 4].map(n => rating(n, "extreme"))).toEqual([9, 8, 7, 6, 5]);
    expect([0, 1, 2, 3, 4].map(n => rating(n, "proven"))).toEqual([5, 6, 7, 8, 9]);
    expect(rating(20, "extreme")).toBe(2);
  });

  it("записи годятся настоящему разбору свойств оружия (resolveWeaponPropsList/aggregateAuto): Порог Extreme и рейтинг Proven доходят до броска", () => {
    const wp0 = aggregateAuto(resolveWeaponPropsList(finalExecutionProps(0)));
    expect([wp0.extremeThreshold, wp0.provenRating]).toEqual([9, 5]);
    const wp2 = aggregateAuto(resolveWeaponPropsList(finalExecutionProps(2)));
    expect([wp2.extremeThreshold, wp2.provenRating]).toEqual([7, 7]);
  });
});

describe("слияние с настоящим оружием (Секира Палача, Extreme(8))", () => {
  const AXE = () => packDoc("weapons", "fQWAUJK0dUjs3wK0");
  const merged = (n, props) => aggregateAuto(resolveWeaponPropsList(mergeExtraProps(props, { ruleProps: finalExecutionProps(n) })));

  it("порог Extreme оружия не ослабляется Талантом: у Секиры 8 остаётся 8, а на 2-й атаке серии — 8→7 (Талант сильнее)", () => {
    const props = AXE().system.weaponProps;
    expect(props.find(p => p.key === "extreme").rating).toBe(8); // данные пака: Extreme(8)
    expect(merged(0, props).extremeThreshold).toBe(8);   // Талант 9 хуже оружия — остаётся 8
    expect(merged(2, props).extremeThreshold).toBe(7);   // Талант 7 лучше — берём его
    expect(merged(0, props).provenRating).toBe(5);
  });

  it("у оружия без Extreme Талант даёт Extreme(9)/Proven(5)", () => {
    const wp = merged(0, [{ key: "balanced", rating: 0, rating2: 0 }]);
    expect([wp.extremeThreshold, wp.provenRating]).toEqual([9, 5]);
  });
});

describe("серия Окончательной Казни: цена и номер атаки", () => {
  it("hasFinalExecution — по Таланту (не по тёзке-Черте)", () => {
    expect(hasFinalExecution(actorWith())).toBe(true);
    expect(hasFinalExecution(actorWith([]))).toBe(false);
    expect(hasFinalExecution({ items: [{ type: "trait", name: "Final Execution / Окончательная Казнь" }] })).toBe(false);
  });

  it("новая серия: номер 0, цена 1 Очко Трофеев; шлюз — отказ без Очка", () => {
    const a = actorWith([FINAL()], { value: 1 });
    expect(finalExecutionStep(a)).toEqual({ n: 0, cost: 1 });
    expect(finalExecutionGate(a)).toMatchObject({ ok: true, cost: 1, n: 0 });
    const empty = actorWith([FINAL()], { value: 0 });
    const g = finalExecutionGate(empty);
    expect(g.ok).toBe(false);
    expect(g.reason).toContain("Трофеев");
  });

  it("commit: первая атака списывает Очко и ведёт серию; вторая того же Раунда бесплатна, свойства сильнее", async () => {
    const a = actorWith([FINAL()], { value: 1 });
    expect(await commitFinalExecution(a)).toBe(true);
    expect(a.system.trophyPoints.value).toBe(0);
    expect(finalExecutionStep(a)).toEqual({ n: 1, cost: 0 });
    // без Очков продолжить серию можно — она оплачена
    expect(finalExecutionGate(a)).toMatchObject({ ok: true, cost: 0, n: 1 });
    expect(await commitFinalExecution(a)).toBe(true);
    expect(a.system.trophyPoints.value).toBe(0);
    expect(finalExecutionStep(a)).toEqual({ n: 2, cost: 0 });
  });

  it("новый Раунд — новая серия (снова цена 1); другой бой — тоже", async () => {
    const a = actorWith([FINAL()], { value: 2 });
    await commitFinalExecution(a);
    globalThis.game.combat = { id: "cb", round: 2, started: true };
    expect(finalExecutionStep(a)).toEqual({ n: 0, cost: 1 });
    globalThis.game.combat = { id: "other", round: 1, started: true };
    expect(finalExecutionStep(a)).toEqual({ n: 0, cost: 1 });
  });

  it("вне боя серий нет: каждое применение — новое, платное", async () => {
    globalThis.game.combat = undefined;
    const a = actorWith([FINAL()], { value: 2 });
    await commitFinalExecution(a);
    expect(finalExecutionStep(a)).toEqual({ n: 0, cost: 1 });
  });

  it("commit без Очка на новой серии — отказ, ничего не записано", async () => {
    const a = actorWith([FINAL()], { value: 0 });
    expect(await commitFinalExecution(a)).toBe(false);
    expect(finalExecutionStep(a)).toEqual({ n: 0, cost: 1 });
  });
});

describe("строка окна атаки", () => {
  it("носителю в ближнем бою — строка с кнопкой; без Таланта или в стрелковой атаке — пусто", () => {
    expect(finalExecutionRowHtml(actorWith(), { isMelee: true })).toContain("atk-final-execution-btn");
    expect(finalExecutionRowHtml(actorWith([]), { isMelee: true })).toBe("");
    expect(finalExecutionRowHtml(actorWith(), { isMelee: false })).toBe("");
  });
});

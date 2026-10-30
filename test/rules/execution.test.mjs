// test/rules/execution.test.mjs
//
// Черта «Казнь» Мастера Казней (Sahara fear-2, решение владельца 30.10.2026 — автоматизировать). Книга:
// «Когда Мастер Казней вооружен двуручным рукопашным оружием в двуручном хвате и совершает им атаку по
// достойной трофейной цели, если он не убил ее этой атакой, он может совершить по ней еще одну атаку тем же
// оружием с той же базой и приемом Обычная Атака. Если Inf цели (или аналог для не-Хаоситов) 30-59, он может
// таким образом атаковать ее до 2-х дополнительных раз, 60-79 – до 3-х, а 80+ – до 4-х. Он может совершать
// Казнь только один раз в Раунд.» Чистые правила без Foundry; Черта и оружие — документы настоящего пака.

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  hasExecution, executionExtraAttacks, isExecutionWeapon, executionSeriesLive, executionStepVerdict
} from "../../module/rules/execution.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");
function packDoc(dir, idTail) {
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(f => {
    const p = path.join(d, f.name);
    return f.isDirectory() ? walk(p) : (f.name.endsWith(`_${idTail}.json`) ? [p] : []);
  });
  const [file] = walk(path.join(ROOT, "packs-src", dir));
  return JSON.parse(fs.readFileSync(file, "utf8"));
}
const EXECUTION = () => packDoc("traits", "OWulIfHDWHU1DvxB");
const FINAL = () => packDoc("talents", "WVsAgRZSj7cPhzoM");
const asItem = d => ({ name: d.name, type: d.type, system: d.system });

describe("hasExecution: Черта «Казнь», не Таланты-тёзки", () => {
  it("Черта из пака — носитель", () => {
    expect(hasExecution({ items: [asItem(EXECUTION())] })).toBe(true);
  });
  it("Талант «Окончательная Казнь» и «Полевая Казнь» Казнью не считаются", () => {
    expect(hasExecution({ items: [asItem(FINAL())] })).toBe(false);
    expect(hasExecution({ items: [{ type: "talent", name: "Field Execution / Полевая Казнь" }] })).toBe(false);
    expect(hasExecution({ items: [{ type: "talent", name: "Execution / Казнь" }] })).toBe(false);   // Талант-тёзка не Черта
    expect(hasExecution({ items: [] })).toBe(false);
  });
});

describe("executionExtraAttacks: Inf цели → число дополнительных атак", () => {
  it("30–59 → 2, 60–79 → 3, 80+ → 4; границы включительно", () => {
    const at = inf => executionExtraAttacks(inf);
    expect([30, 45, 59].map(at)).toEqual([2, 2, 2]);
    expect([60, 70, 79].map(at)).toEqual([3, 3, 3]);
    expect([80, 95, 200].map(at)).toEqual([4, 4, 4]);
  });
  it("ниже 30 — одна дополнительная атака («еще одну атаку» из текста); мусор — 0", () => {
    expect([0, 29, 29.9, -5].map(executionExtraAttacks)).toEqual([1, 1, 1, 1]);
    expect([undefined, "x", NaN].map(executionExtraAttacks)).toEqual([0, 0, 0]);
  });
});

describe("isExecutionWeapon: двуручное оружие в двуручном хвате", () => {
  const weapon = grips => ({ system: { weaponClass: "melee", grips } });
  it("основной хват 2р и выбран 2р — да (меч-двуручник «2р (1р)»)", () => {
    expect(isExecutionWeapon(weapon("2р (1р)"), "2р")).toBe(true);
    expect(isExecutionWeapon(weapon("2р"), "2р")).toBe(true);
  });
  it("двуручный хват одноручного оружия («1р (2р)») — не двуручное оружие", () => {
    expect(isExecutionWeapon(weapon("1р (2р)"), "2р")).toBe(false);
  });
  it("двуручное оружие, но взято одной рукой — нет хвата", () => {
    expect(isExecutionWeapon(weapon("2р (1р)"), "1р")).toBe(false);
  });
  it("не рукопашное оружие — нет; нет оружия — нет", () => {
    expect(isExecutionWeapon({ system: { weaponClass: "basic", grips: "2р" } }, "2р")).toBe(false);
    expect(isExecutionWeapon(null, "2р")).toBe(false);
  });
});

describe("серия Казни: раз в Раунд, по одной цели, не больше положенного числа", () => {
  const combat = { id: "cb", round: 3 };
  const rec = (patch = {}) => ({ combatId: "cb", round: 3, targetUuid: "Actor.v", total: 3, used: 1, ...patch });

  it("серия жива только в своём бою и своём Раунде", () => {
    expect(executionSeriesLive(rec(), combat)).toBe(true);
    expect(executionSeriesLive(rec({ round: 2 }), combat)).toBe(false);
    expect(executionSeriesLive(rec({ combatId: "other" }), combat)).toBe(false);
    expect(executionSeriesLive(null, combat)).toBe(false);
    expect(executionSeriesLive(rec(), null)).toBe(false);
  });

  it("нет боя — Казни нет: «раз в Раунд» без Раунда не имеет смысла", () => {
    expect(executionStepVerdict({ series: null, combat: null, targetUuid: "Actor.v", total: 2 }).ok).toBe(false);
  });

  it("нет серии: старт разрешён, если положена хоть одна доп. атака", () => {
    expect(executionStepVerdict({ series: null, combat, targetUuid: "Actor.v", total: 2 })).toMatchObject({ ok: true, left: 2 });
    const v = executionStepVerdict({ series: null, combat, targetUuid: "Actor.v", total: 0 });
    expect(v.ok).toBe(false);
  });

  it("серия жива: осталось total − used; исчерпана — отказ", () => {
    expect(executionStepVerdict({ series: rec({ used: 1, total: 3 }), combat, targetUuid: "Actor.v" })).toMatchObject({ ok: true, left: 2 });
    const done = executionStepVerdict({ series: rec({ used: 3, total: 3 }), combat, targetUuid: "Actor.v" });
    expect(done.ok).toBe(false);
    expect(done.reason).toContain("исчерпан");
  });

  it("Казнь раз в Раунд: другая цель в том же Раунде — отказ", () => {
    const v = executionStepVerdict({ series: rec(), combat, targetUuid: "Actor.other", total: 4 });
    expect(v.ok).toBe(false);
    expect(v.reason).toContain("раз в Раунд");
  });

  it("устаревшая серия (прошлый Раунд) не мешает начать новую", () => {
    expect(executionStepVerdict({ series: rec({ round: 2, used: 3 }), combat, targetUuid: "Actor.other", total: 2 }))
      .toMatchObject({ ok: true, left: 2 });
  });
});

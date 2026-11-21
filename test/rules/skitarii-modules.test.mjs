// Модули Скитарии: лимит ½ T.b (окр.▲), −30 сверх лимита, Скитарий Альфа,
// Смещающаяся Мантия, Кибердьякон (остаток Талантов, 20.11.2026).
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { moduleLimits, moduleCounts, modulesOverLimit, isSkitariiModule, skitariiModuleSummary,
         mantleSwapAllowed, mantleSwapMark, MECHANICUM_WEAPONS, boonWeaponOk } from "../../module/rules/skitarii-modules.mjs";
import { arkhanCanPayCharge } from "../../module/rules/skitarii-modules.mjs";
import { implantMech } from "../../module/constants/implant-mechanics.mjs";
import { PREDICATES } from "../../module/rules/predicates.mjs";
import { SKITARII_RULES } from "../../module/rules/library/skitarii.mjs";

const mod = (id, { cat = "skitarii", installed = true, disabled = false, name = `Модуль ${id}` } = {}) => {
  const flags = { installed, disabled };
  return { id, type: "implant", name, system: { category: cat }, getFlag: (_ns, k) => flags[k] };
};
const talent = name => ({ type: "talent", name });
const actor = (tb, items, flags = {}) => ({
  system: { characteristics: { t: { bonus: tb } } }, items,
  getFlag: (_ns, k) => flags[k]
});

describe("лимиты", () => {
  it("½ T.b с округлением вверх, Альфа +1, Мантия +2 установленных", () => {
    expect(moduleLimits({ tb: 5 })).toEqual({ active: 3, installed: 3 });
    expect(moduleLimits({ tb: 4, alpha: true })).toEqual({ active: 3, installed: 3 });
    expect(moduleLimits({ tb: 4, mantle: true })).toEqual({ active: 2, installed: 4 });
  });
  it("Латы — не Модуль; кибернетика Механикум — только у Кибердьякона и не Энергосистемы", () => {
    expect(isSkitariiModule(mod("w", { name: "Skitarii War Plate / Боевые Латы Скитарии" }))).toBe(false);
    expect(isSkitariiModule(mod("c", { cat: "mechOther" }))).toBe(false);
    expect(isSkitariiModule(mod("c", { cat: "mechOther" }), { cyberdeacon: true })).toBe(true);
    expect(isSkitariiModule(mod("e", { cat: "mechEnergy" }), { cyberdeacon: true })).toBe(false);
  });
  it("неустановленный не считается, отключённый — только в установленных", () => {
    const a = actor(4, [mod("a"), mod("b", { installed: false }), mod("c", { disabled: true })]);
    expect(moduleCounts(a)).toMatchObject({ installed: 2, active: 1 });
  });
});

describe("перегрузка", () => {
  it("T.b 4: третий Модуль — перегрузка, Альфа снимает", () => {
    const items = [mod("a"), mod("b"), mod("c")];
    expect(modulesOverLimit(actor(4, items))).toBe(true);
    expect(modulesOverLimit(actor(4, items), { alpha: true })).toBe(false);
  });
  it("Мантия: 4 установлено при 2 действующих — без штрафа; 3 действующих — штраф", () => {
    const ok = [mod("a"), mod("b"), mod("c", { disabled: true }), mod("d", { disabled: true })];
    expect(modulesOverLimit(actor(4, ok), { mantle: true })).toBe(false);
    expect(modulesOverLimit(actor(4, ok))).toBe(true);
    const bad = [mod("a"), mod("b"), mod("c"), mod("d", { disabled: true })];
    expect(modulesOverLimit(actor(4, bad), { mantle: true })).toBe(true);
  });
  it("предикат читает Таланты по имени, правило даёт −30 ко всему", () => {
    const items = [mod("a"), mod("b"), mod("c")];
    expect(PREDICATES.skitariiModulesOverLimit(actor(4, items), {}, true)).toBe(true);
    expect(PREDICATES.skitariiModulesOverLimit(actor(4, [...items, talent("Skitarii Alpha / Скитарий Альфа")]), {}, true)).toBe(false);
    expect(SKITARII_RULES[0].effects[0]).toMatchObject({ kind: "rollBonus", target: "all", value: -30, auto: true });
  });
  it("сводка листа: нет Модулей — null", () => {
    expect(skitariiModuleSummary(actor(4, []))).toBeNull();
    const s = skitariiModuleSummary(actor(4, [mod("a"), talent("Shifting Mantle / Смещающаяся Мантия")]));
    expect(s).toMatchObject({ active: 1, activeMax: 2, installedMax: 4, mantle: true, over: false });
  });
});

describe("Мантия раз в Ход", () => {
  const combat = { id: "c1", round: 2, turn: 1 };
  it("вне боя — без ограничений, отметки нет", () => {
    expect(mantleSwapAllowed(actor(4, []), null, "off")).toBe(true);
    expect(mantleSwapMark(actor(4, []), null, "off")).toBeNull();
  });
  it("одно отключение и одно включение за Ход", () => {
    const mark = mantleSwapMark(actor(4, []), combat, "off");
    const a = actor(4, [], { shiftingMantleSwap: mark });
    expect(mantleSwapAllowed(a, combat, "off")).toBe(false);
    expect(mantleSwapAllowed(a, combat, "on")).toBe(true);
    expect(mantleSwapMark(a, combat, "on")).toMatchObject({ off: true, on: true });
    expect(mantleSwapAllowed(a, { ...combat, turn: 2 }, "off")).toBe(true);
  });
});

describe("Дар Омниссии", () => {
  it("список оружия Механикум совпадает с папкой пака", () => {
    const dir = "packs-src/weapons/Имперское/Стрелковое/Механикум";
    const names = fs.readdirSync(dir).filter(f => f.endsWith(".json") && !f.startsWith("_"))
      .map(f => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")).name.split("/")[0].trim()).sort();
    expect([...MECHANICUM_WEAPONS].sort()).toEqual(names);
  });
  it("Механикум или SP, и только с магазином", () => {
    const w = (name, weaponType, magazineMax = 10) => ({ type: "weapon", name, system: { weaponType, magazineMax } });
    expect(boonWeaponOk(w("Radium Carbine / Радиевый Карабин", "exotic"))).toBe(true);
    expect(boonWeaponOk(w("Autogun / Автомат", "solid"))).toBe(true);
    expect(boonWeaponOk(w("Lasgun / Лазган", "laser"))).toBe(false);
    expect(boonWeaponOk(w("Autogun / Автомат", "solid", 0))).toBe(false);
  });
});

// Избавление Аркхана (Sahara 585-deliverance-of-arkhan): Актуаторные Банки Лат —
// «работают как Потенциа-Коил на 1⚡», заряд берётся из общей Катушки.

describe("Актуаторные Банки и Избавление Аркхана", () => {
  const plate = { type: "implant", name: "Skitarii War Plate / Боевые Латы Скитарии" };
  it("Латы дают +1 к максимуму Катушки (таблица механик имплантов)", () => {
    expect(implantMech(plate.name)?.energyMax).toBe(1);
  });
  it("заряд можно потратить только с Латами и при заряде ≥ 1", () => {
    expect(arkhanCanPayCharge({ items: [plate], system: { energy: { value: 1 } } })).toBe(true);
    expect(arkhanCanPayCharge({ items: [plate], system: { energy: { value: 0 } } })).toBe(false);
    expect(arkhanCanPayCharge({ items: [], system: { energy: { value: 3 } } })).toBe(false);
  });
});

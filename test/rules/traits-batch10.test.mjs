// dbc-114 (14.11.2026), пачка 10: Надёжный Вояка, Кровь Героев, Выступление, Бахвальное Богатство, Не Помешает.
import "../support/foundry-stub.mjs";
import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { reliableSoldierBonus, reliableTypeOf } from "../../module/rules/reliable-soldier.mjs";
import {
  bloodHeroesAvailable, bloodHeroesThreshold, bloodHeroesChanges, performanceAvailable, performanceChanges, AP_ZONES
} from "../../module/rules/fate-abilities.mjs";
import { CAPABILITIES } from "../../module/constants/capabilities.mjs";

const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => {
  const q = path.join(d, e.name);
  return e.isDirectory() ? walk(q) : (e.name.endsWith(".json") && !e.name.startsWith("_") ? [q] : []);
});
const docs = walk(path.resolve("packs-src/traits")).map(f => JSON.parse(fs.readFileSync(f, "utf8")));
const entries = prefix => docs.find(j => (j.name || "").startsWith(prefix)).flags["warhammer-dbc"].mechanics.flatMap(g => g.entries);

describe("Надёжный Вояка", () => {
  const sword = { system: { meleeCategory: "Меч", weaponType: "" } };
  const bolter = { system: { meleeCategory: "", weaponType: "bolt" } };
  it("тип рукопашного — категория, стрелкового — weaponType", () => {
    expect(reliableTypeOf(sword, true)).toBe("Меч");
    expect(reliableTypeOf(bolter, false)).toBe("bolt");
  });
  it("выбранный тип — +2 Dmg, +1 Pen; чужой тип или нет выбора — 0", () => {
    expect(reliableSoldierBonus({ chosenMelee: "Меч", chosenRanged: "", weapon: sword, isMelee: true })).toEqual({ dmg: 2, pen: 1 });
    expect(reliableSoldierBonus({ chosenMelee: "", chosenRanged: "BOLT", weapon: bolter, isMelee: false })).toEqual({ dmg: 2, pen: 1 });
    expect(reliableSoldierBonus({ chosenMelee: "Топор", chosenRanged: "", weapon: sword, isMelee: true })).toEqual({ dmg: 0, pen: 0 });
    expect(reliableSoldierBonus({ chosenMelee: "", chosenRanged: "", weapon: sword, isMelee: true })).toEqual({ dmg: 0, pen: 0 });
  });
});

describe("Кровь Героев", () => {
  it("первый раз за битву — старт; повтор — только смена; потом отказ", () => {
    const c = { id: "c1" };
    expect(bloodHeroesAvailable({ hasEffect: false }, c).mode).toBe("start");
    expect(bloodHeroesAvailable({ used: "c1", hasEffect: false }, c).mode).toBeNull();
    expect(bloodHeroesAvailable({ used: "c1", hasEffect: true }, c).mode).toBe("change");
    expect(bloodHeroesAvailable({ used: "c1", changed: "c1", hasEffect: true }, c).mode).toBeNull();
  });
  it("вне боя ограничений нет", () => {
    expect(bloodHeroesAvailable({ hasEffect: false }, null).mode).toBe("start");
    expect(bloodHeroesAvailable({ hasEffect: true }, null).mode).toBe("change");
  });
  it("порог W+10 для старта и W−10 для смены", () => {
    expect(bloodHeroesThreshold(40, "start")).toBe(50);
    expect(bloodHeroesThreshold(40, "change")).toBe(30);
  });
  it("Unnatural +1 на выбранную Характеристику; неизвестный ключ — пусто", () => {
    expect(bloodHeroesChanges("t")).toEqual([{ key: "system.characteristics.t.bonusFx", type: "add", value: 1, phase: "initial", priority: 0 }]);
    expect(bloodHeroesChanges("inf")).toEqual([]);
    expect(bloodHeroesChanges(undefined)).toEqual([]);
  });
});

describe("Выступление", () => {
  it("раз в Раунд боя", () => {
    expect(performanceAvailable("c1:2", { id: "c1", round: 2 })).toBe(false);
    expect(performanceAvailable("c1:2", { id: "c1", round: 3 })).toBe(true);
    expect(performanceAvailable("c1:2", null)).toBe(true);
  });
  it("+A.b к AP во всех шести зонах; при A.b = 0 — пусто", () => {
    const ch = performanceChanges(4);
    expect(ch).toHaveLength(6);
    expect(ch.map(c => c.key)).toEqual(AP_ZONES.map(z => `system.armorBonus.${z}`));
    expect(ch.every(c => c.value === 4)).toBe(true);
    expect(performanceChanges(0)).toEqual([]);
  });
});

describe("данные Черт", () => {
  it("Бахвальное Богатство: галочки +15 на Торговлю, Внимательность, Безопасность", () => {
    const m = entries("Bragging Wealth / ").filter(e => e.kind === "testMod").map(e => [e.skillKey, e.value, e.modAuto]);
    expect(m).toEqual([["commerce", 15, false], ["awareness", 15, false], ["security", 15, false]]);
  });
  it("Не Помешает: галочка +20 на Внимательность", () => {
    const m = entries("Couldn't Hurt / ").find(e => e.kind === "testMod");
    expect([m.skillKey, m.value, m.modAuto]).toEqual(["awareness", 20, false]);
  });
  it("Надёжный Вояка, Кровь Героев, Выступление: способность с читателем и кнопка", () => {
    const cases = [["Reliable Soldier / ", "weapon.reliableSoldier", "chooseReliableTypes(actor)"],
      ["The Blood of Heroes / ", "fate.bloodOfHeroes", "useBloodOfHeroes(actor)"], ["Performance / ", "fate.performance", "usePerformance(actor)"]];
    for (const [prefix, key, call] of cases) {
      const e = entries(prefix);
      expect(e.map(x => x.capabilityKey), prefix).toContain(key);
      expect(e.find(x => x.kind === "script").code, prefix).toContain(call);
      expect(CAPABILITIES[key].reader, key).toBeTruthy();
    }
  });
});

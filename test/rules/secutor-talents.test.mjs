// Секутор: Деструктор, Берсерк-Стрелок, Мирмидон, Ординатор, Непрерывный Натиск (21.11.2026).
import { describe, it, expect } from "vitest";
import "../support/foundry-stub.mjs";
import {
  destructorPenBonus, highTechTarget, meleeShotClass, ordinatorStands, sustainedNext, sustainedAssaultBonus,
  gunzerkerActive, DESTRUCTOR_FLAG, SUSTAINED_FLAG, GUNZERKER_FLAG
} from "../../module/rules/secutor-talents.mjs";

const actor = (names = [], flags = {}, extra = {}) => ({
  items: names.map(n => typeof n === "string" ? { type: "talent", name: n } : n),
  flags: { "warhammer-dbc": flags }, system: {}, ...extra
});

describe("Деструктор", () => {
  const sec = actor(["Destructor / Деструктор"], { [DESTRUCTOR_FLAG]: "c1" });
  const tank = { type: "vehicle", items: [] };
  it("+½I.b (окр.▲) к Pen только со Структурным Анализом, в бою включения, по высокотехнологичной цели", () => {
    expect(destructorPenBonus(sec, { structural: true, targetActor: tank, combatId: "c1", intBonus: 5 })).toBe(3);
    expect(destructorPenBonus(sec, { structural: false, targetActor: tank, combatId: "c1", intBonus: 5 })).toBe(0);
    expect(destructorPenBonus(sec, { structural: true, targetActor: tank, combatId: "c2", intBonus: 5 })).toBe(0);
    expect(destructorPenBonus(sec, { structural: true, targetActor: actor(), combatId: "c1", intBonus: 5 })).toBe(0);
  });
  it("цель: техника, Machine или непримитивная броня", () => {
    const armour = props => ({ type: "armor", system: { equipped: true, properties: props } });
    expect(highTechTarget(actor([armour([])]))).toBe(true);
    expect(highTechTarget(actor([armour(["primitive"])]))).toBe(false);
    expect(highTechTarget(actor([{ type: "trait", name: "Machine / Машина (X)" }]))).toBe(true);
  });
});

describe("Мирмидон", () => {
  const m = actor(["Myrmidon / Мирмидон"]);
  const w = cls => ({ system: { weaponClass: cls } });
  it("винтовка — пистолет, тяжёлое и длинная винтовка — винтовка", () => {
    expect(meleeShotClass(m, w("basic")).cls).toBe("pistol");
    expect(meleeShotClass(m, w("heavy")).noMeleeFire).toBe(false);
    expect(meleeShotClass(m, w("basic"), { noMeleeFire: true }).cls).toBe("basic");
  });
  it("без Таланта — как в книге", () => {
    expect(meleeShotClass(actor(), w("heavy")).noMeleeFire).toBe(true);
    expect(meleeShotClass(actor(), w("basic")).cls).toBe("basic");
  });
});

describe("Ординатор", () => {
  const o = actor(["Ordinator / Ординатор"], {}, { system: { sizeTotal: 2 } });
  it("устоит, кроме рукопашного приёма того, кто больше", () => {
    expect(ordinatorStands(o, {})).toBe(true);
    expect(ordinatorStands(o, { melee: true, attacker: { system: { sizeTotal: 2 } } })).toBe(true);
    expect(ordinatorStands(o, { melee: true, attacker: { system: { sizeTotal: 3 } } })).toBe(false);
    expect(ordinatorStands(actor(), {})).toBe(false);
  });
});

describe("Непрерывный Натиск", () => {
  const t1 = { uuid: "A.1" }, t2 = { uuid: "A.2" };
  it("счёт подряд по одной цели, смена цели — сброс", () => {
    let f = sustainedNext(null, t1, "c");
    f = sustainedNext(f, t1, "c");
    expect(f.count).toBe(2);
    expect(sustainedNext(f, t2, "c").count).toBe(1);
    expect(sustainedNext(f, t1, "other").count).toBe(1);
  });
  it("+3 за каждую предыдущую атаку", () => {
    const s = actor(["Sustained Assault / Непрерывный Натиск"], { [SUSTAINED_FLAG]: { combatId: "c", target: "A.1", count: 2 } });
    expect(sustainedAssaultBonus(s, t1, "c")).toBe(6);
    expect(sustainedAssaultBonus(s, t2, "c")).toBe(0);
  });
});

describe("Берсерк-Стрелок", () => {
  it("метка действует только в своём Раунде", () => {
    const g = actor(["Gunzerker / Берсерк-Стрелок"], { [GUNZERKER_FLAG]: { combatId: "c", round: 2 } });
    expect(gunzerkerActive(g, { combatId: "c", round: 2 })).toBe(true);
    expect(gunzerkerActive(g, { combatId: "c", round: 3 })).toBe(false);
  });
});

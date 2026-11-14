// dbc-114 (14.11.2026), пачка 7: Момент Гладиатора и Daemonic (+N) у архетипов. Фикстуры — настоящие JSON из packs-src.
import "../support/foundry-stub.mjs";
import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import {
  momentumMax, momentumAfter, momentumBonus, momentumAttackCounts, MOMENTUM_SPENDS
} from "../../module/rules/momentum.mjs";
import { mechRollData } from "../../module/rules/mech-formula.mjs";
import { CAPABILITIES } from "../../module/constants/capabilities.mjs";

const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => {
  const q = path.join(d, e.name);
  return e.isDirectory() ? walk(q) : (e.name.endsWith(".json") && !e.name.startsWith("_") ? [q] : []);
});
const docs = walk(path.resolve("packs-src/traits")).map(f => JSON.parse(fs.readFileSync(f, "utf8")));
const entries = prefix => docs.find(j => (j.name || "").startsWith(prefix)).flags["warhammer-dbc"].mechanics.flatMap(g => g.entries);

describe("очки Момента", () => {
  it("максимум — A.b без Unnatural: ⌊A/10⌋ по значению", () => {
    expect(momentumMax(47)).toBe(4);
    expect(momentumMax(50)).toBe(5);
    expect(momentumMax(0)).toBe(0);
    expect(momentumMax(undefined)).toBe(0);
  });
  it("изменение в пределах 0…максимум", () => {
    expect(momentumAfter(0, -1, 4)).toBe(0);
    expect(momentumAfter(3, +1, 4)).toBe(4);
    expect(momentumAfter(4, +1, 4)).toBe(4);
    expect(momentumAfter(2, -1, 4)).toBe(1);
    expect(momentumAfter(undefined, +1, 3)).toBe(1);
  });
  it("+5 к тестам за очко", () => {
    expect([0, 1, 3].map(momentumBonus)).toEqual([0, 5, 15]);
  });
  it("считаются только рукопашные и метательные атаки", () => {
    expect(momentumAttackCounts({ isMelee: true })).toBe(true);
    expect(momentumAttackCounts({ isMelee: false, weaponClass: "thrown" })).toBe(true);
    expect(momentumAttackCounts({ isMelee: false, weaponClass: "heavy" })).toBe(false);
  });
  it("шесть видов трат с подсказками; Оглушение и Кровотечение снимают Состояние", () => {
    expect(Object.keys(MOMENTUM_SPENDS).sort()).toEqual(["flip", "ignoreBleed", "ignoreFatigue", "ignoreStun", "redSands", "success3"]);
    expect(MOMENTUM_SPENDS.ignoreStun.clears).toBe("stunned");
    expect(MOMENTUM_SPENDS.ignoreBleed.clears).toBe("bleeding");
  });
  it("переменная формул momentum берётся из флага актора, без него 0", () => {
    expect(mechRollData({ flags: { "warhammer-dbc": { momentum: 3 } } }).momentum).toBe(3);
    expect(mechRollData({}).momentum).toBe(0);
  });
});

describe("данные Момента", () => {
  it("Момент выдаёт способность и две кнопки трат", () => {
    const e = entries("Momentum / ");
    expect(e.map(x => x.capabilityKey)).toContain("pool.momentum");
    const codes = e.filter(x => x.kind === "script").map(x => x.code);
    expect(codes.some(c => c.includes('spendMomentum(actor, "success3")'))).toBe(true);
    expect(codes.some(c => c.includes('spendMomentum(actor, "flip")'))).toBe(true);
    expect(CAPABILITIES["pool.momentum"].reader).toBeTruthy();
  });
  it("Идущие на Смерть и Красные Пески — кнопки трат", () => {
    const m = entries("Morituri / ").filter(x => x.kind === "script").map(x => x.code).join("\n");
    expect(m).toContain('"ignoreStun"');
    expect(m).toContain('"ignoreBleed"');
    expect(m).toContain('"ignoreFatigue"');
    expect(entries("Morituri / ").map(x => x.capabilityKey)).toContain("damage.morituri");
    expect(entries("Red Sands / ").find(x => x.kind === "script").code).toContain('"redSands"');
  });
});

describe("Daemonic (+N): бонус к Бонусу Стойкости", () => {
  const daemonic = docs.filter(j => j.type === "trait" && /^Daemonic \(\+\d+\) \/ /.test(j.name || ""));
  it("пять Черт архетипов, у каждой ActiveEffect на t.bonusFx на N", () => {
    expect(daemonic).toHaveLength(5);
    for (const d of daemonic) {
      const n = Number(/\(\+(\d+)\)/.exec(d.name)[1]);
      const ch = d.effects.flatMap(e => e.system.changes);
      expect(ch, d.name).toEqual([{ key: "system.characteristics.t.bonusFx", type: "add", value: n, phase: "initial", priority: 0 }]);
    }
  });
});

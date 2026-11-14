// dbc-114 (14.11.2026), пачка 3: Крепкий, Подхалим, иммунитеты и уничтожение Роя. Фикстуры — настоящие JSON из packs-src.
import "../support/foundry-stub.mjs";
import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { sturdyResistMods, STURDY_BONUS } from "../../module/rules/sturdy.mjs";
import { knockdownResistMods } from "../../module/combat/knockdown.mjs";
import { CAPABILITIES } from "../../module/constants/capabilities.mjs";

const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => {
  const q = path.join(d, e.name);
  return e.isDirectory() ? walk(q) : (e.name.endsWith(".json") && !e.name.startsWith("_") ? [q] : []);
});
const traitDocs = walk(path.resolve("packs-src/traits")).map(f => JSON.parse(fs.readFileSync(f, "utf8")));
const trait = prefix => traitDocs.find(j => (j.name || "").startsWith(prefix));
const entries = d => d.flags["warhammer-dbc"].mechanics.flatMap(g => g.entries);
const sturdyActor = { items: [{ flags: { "warhammer-dbc": { mechanics: [{ operator: "AND", entries: [{ kind: "capability", capabilityKey: "resist.sturdy" }] }] } } }] };

describe("Крепкий", () => {
  it("числа книги: Борьба и Оглушение +20, сбивание и отбрасывание +30", () => {
    expect(STURDY_BONUS).toEqual({ grapple: 20, stun: 20, knockdown: 30, knockback: 30 });
  });
  it("без Черты и с неизвестным видом — пусто", () => {
    expect(sturdyResistMods({ items: [] }, "grapple")).toEqual([]);
    expect(sturdyResistMods(sturdyActor, "unknown")).toEqual([]);
    expect(sturdyResistMods(null, "grapple")).toEqual([]);
  });
  it("с Чертой — модификатор «Крепкий»", () => {
    expect(sturdyResistMods(sturdyActor, "grapple")).toEqual([{ label: "Крепкий", value: 20 }]);
    expect(sturdyResistMods(sturdyActor, "knockdown")).toEqual([{ label: "Крепкий", value: 30 }]);
  });
  it("встречный тест Повалить: цель-Крепкий получает +30 к сопротивлению", () => {
    const me = { system: {}, items: [] };
    expect(knockdownResistMods(me, sturdyActor).some(m => m.label === "Крепкий" && m.value === 30)).toBe(true);
    expect(knockdownResistMods(me, { system: {}, items: [] }).some(m => m.label === "Крепкий")).toBe(false);
  });
  it("Черта выдаёт способность с читателем", () => {
    expect(entries(trait("Sturdy / ")).map(e => e.capabilityKey)).toContain("resist.sturdy");
    expect(CAPABILITIES["resist.sturdy"].reader).toBeTruthy();
  });
});

describe("Рой: иммунитеты", () => {
  const swarm = entries(trait("Swarm / "));
  it("не сбить с ног и не взять в Захват", () => {
    const imm = swarm.filter(e => e.kind === "condition" && e.condMode === "immunity").map(e => e.condKey);
    expect(imm).toEqual(expect.arrayContaining(["prone", "grappling"]));
  });
  it("не связать: иммунитет к Snare", () => {
    expect(swarm.map(e => e.capabilityKey)).toContain("weaponPropertyImmunity.snare");
  });
});

describe("Подхалим", () => {
  it("при получении даёт +15 к Лояльности (значение и максимум) и помечает откат", () => {
    const s = entries(trait("Sycophant / ")).find(e => e.kind === "script");
    expect(s.code).toContain("system.loyalty.max");
    expect(s.code).toContain("system.loyalty.value");
    expect(s.code).toContain("poolApplied");
    expect(s.code).toMatch(/amount = 15/);
    // код синтаксически исполним как тело async-функции
    expect(() => new Function(`return (async function(actor,item){${s.code}})`)).not.toThrow();
  });
});

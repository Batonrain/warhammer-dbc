// dbc-114 (14.11.2026), пачка 6: Идущие на Смерть (Гладиатор), Трупный Яд (Чумной Монах) и сверка уже работающих архетипных Черт.
import "../support/foundry-stub.mjs";
import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { morituriDamage } from "../../module/rules/morituri.mjs";
import { CAPABILITIES } from "../../module/constants/capabilities.mjs";

const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => {
  const q = path.join(d, e.name);
  return e.isDirectory() ? walk(q) : (e.name.endsWith(".json") && !e.name.startsWith("_") ? [q] : []);
});
const docs = walk(path.resolve("packs-src/traits")).map(f => JSON.parse(fs.readFileSync(f, "utf8")));
const entries = prefix => docs.find(j => (j.name || "").startsWith(prefix)).flags["warhammer-dbc"].mechanics.flatMap(g => g.entries);

describe("Идущие на Смерть", () => {
  it("AP носимой брони места ≤ 2 — урон ÷3 вверх", () => {
    expect(morituriDamage(9, 0)).toBe(3);
    expect(morituriDamage(10, 2)).toBe(4);
    expect(morituriDamage(1, 1)).toBe(1);
  });
  it("AP выше 2 или нулевой урон — без изменений", () => {
    expect(morituriDamage(9, 3)).toBe(9);
    expect(morituriDamage(0, 0)).toBe(0);
    expect(morituriDamage(-2, 0)).toBe(-2);
  });
  it("в паке: способность с читателем", () => {
    expect(entries("Morituri / ").map(e => e.capabilityKey)).toContain("damage.morituri");
    expect(CAPABILITIES["damage.morituri"].reader).toBeTruthy();
  });
});

describe("Трупный Яд", () => {
  it("безоружные атаки получают Toxic (2) и Corrosive (2)", () => {
    const props = entries("Corpse Poison / ").filter(e => e.kind === "attackProp");
    expect(props.map(e => [e.apScope, e.apKey, e.apRating])).toEqual([["unarmed", "toxic", "2"], ["unarmed", "corrosive", "2"]]);
  });
});

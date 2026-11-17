// dbc-114 (14.11.2026), пачка 5: Авто-Стабилизированный, Душесвязанный, Утончённая Речь. Фикстуры — настоящие JSON из packs-src.
import "../support/foundry-stub.mjs";
import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { isBraced } from "../../module/combat/brace-weapon.mjs";
import { CAPABILITIES } from "../../module/constants/capabilities.mjs";

const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => {
  const q = path.join(d, e.name);
  return e.isDirectory() ? walk(q) : (e.name.endsWith(".json") && !e.name.startsWith("_") ? [q] : []);
});
const docs = walk(path.resolve("packs-src/traits")).map(f => JSON.parse(fs.readFileSync(f, "utf8")));
const entries = prefix => docs.find(j => (j.name || "").startsWith(prefix)).flags["warhammer-dbc"].mechanics.flatMap(g => g.entries);
const withCap = key => ({ items: [{ flags: { "warhammer-dbc": { mechanics: [{ operator: "AND", entries: [{ kind: "capability", capabilityKey: key }] }] } } }], getFlag: () => undefined });

describe("Авто-Стабилизированный", () => {
  it("тяжёлое оружие носителя всегда Закреплено, без Черты — по состоянию", () => {
    expect(isBraced(withCap("weapon.autoBraced"), { id: "w1" })).toBe(true);
    expect(isBraced({ items: [], getFlag: () => undefined }, { id: "w1" })).toBe(false);
  });
  it("в паке: Черта выдаёт способность с читателем", () => {
    expect(entries("Auto-Stabilized / ").map(e => e.capabilityKey)).toContain("weapon.autoBraced");
    expect(CAPABILITIES["weapon.autoBraced"].reader).toBeTruthy();
  });
});

describe("Душесвязанный", () => {
  it("в паке: способность двух бросков на Прорыв с читателем", () => {
    expect(entries("Soul-Bound / ").map(e => e.capabilityKey)).toContain("psychic.perilTwoRolls");
    expect(CAPABILITIES["psychic.perilTwoRolls"].reader).toBeTruthy();
  });
});

describe("Утончённая Речь", () => {
  it("галочка +15 в окне социального теста", () => {
    const m = entries("Sophisticated Speech / ").find(e => e.kind === "testMod");
    expect(m).toMatchObject({ modScope: "social", value: 15, modAuto: false });
  });
});

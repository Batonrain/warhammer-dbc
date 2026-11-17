// dbc-114 (14.11.2026), пачка 8: Структурный Анализ, Отвергни Пламя, Пожиратель Мертвечины, Мотивирующая Стимуляция.
import "../support/foundry-stub.mjs";
import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { structuralAnalysisBonus, isEnergyWeapon } from "../../module/rules/mechanicus-monk-traits.mjs";
import { CAPABILITIES } from "../../module/constants/capabilities.mjs";

const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => {
  const q = path.join(d, e.name);
  return e.isDirectory() ? walk(q) : (e.name.endsWith(".json") && !e.name.startsWith("_") ? [q] : []);
});
const docs = walk(path.resolve("packs-src/traits")).map(f => JSON.parse(fs.readFileSync(f, "utf8")));
const entries = prefix => docs.find(j => (j.name || "").startsWith(prefix)).flags["warhammer-dbc"].mechanics.flatMap(g => g.entries);

describe("Структурный Анализ", () => {
  it("+I.b только при одиночной Избирательной атаке", () => {
    expect(structuralAnalysisBonus({ selective: true, single: true, intBonus: 5 })).toBe(5);
    expect(structuralAnalysisBonus({ selective: false, single: true, intBonus: 5 })).toBe(0);
    expect(structuralAnalysisBonus({ selective: true, single: false, intBonus: 5 })).toBe(0);
    expect(structuralAnalysisBonus({ selective: true, single: true })).toBe(0);
  });
  it("в паке: способность с читателем", () => {
    expect(entries("Structural Analysis / ").map(e => e.capabilityKey)).toContain("damage.structuralAnalysis");
    expect(CAPABILITIES["damage.structuralAnalysis"].reader).toBeTruthy();
  });
});

describe("Отвергни Пламя", () => {
  it("оружие с E Dmg определяется по типу урона", () => {
    expect(isEnergyWeapon({ system: { damageType: "energy" } })).toBe(true);
    expect(isEnergyWeapon({ system: { damageType: "Energy" } })).toBe(true);
    expect(isEnergyWeapon({ system: { damageType: "rending" } })).toBe(false);
    expect(isEnergyWeapon(null)).toBe(false);
  });
  it("в паке: способность с читателем", () => {
    expect(entries("Forsake the Flame / ").map(e => e.capabilityKey)).toContain("weapon.noEnergy");
    expect(CAPABILITIES["weapon.noEnergy"].reader).toBeTruthy();
  });
});

describe("Мотивирующая Стимуляция", () => {
  it("S, T и A — дружественные Характеристики", () => {
    const e = entries("Motive Stimulation / ").filter(x => x.capabilityMode === "aptOverride");
    expect(e.map(x => [x.capabilityAptScope, x.capabilityAptMatch, x.capabilityAptAlign]))
      .toEqual([["characteristic", "s", "ally"], ["characteristic", "t", "ally"], ["characteristic", "ag", "ally"]]);
  });
});

describe("Пожиратель Мертвечины", () => {
  it("кнопка исполнима как тело async-функции и лечит через healActor", () => {
    const s = entries("Carrion Eater / ").find(x => x.kind === "script");
    expect(s.code).toContain("healActor(actor, amount");
    expect(() => new Function("healActor", "game", "ui", "Roll", "ChatMessage", "actor", `return (async function(){${s.code}})`)).not.toThrow();
  });
});

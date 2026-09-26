// test/rules/library/squat.test.mjs
//
// Сверка расы Скват с корбуком (глава I).

import { describe, it, expect } from "vitest";
import "../../support/foundry-stub.mjs";
import { packDocById } from "../../support/pack-doc.mjs";
import { resolveTest } from "../../../module/rules/resolve-test.mjs";
import { hasRuleFlag } from "../../../module/rules/flags.mjs";
import { nextMutationThreshold } from "../../../module/rules/character.mjs";
import { archetypesForRace } from "../../../module/apps/archetypes.mjs";
import { SURE_TREAD_FLAG } from "../../../module/combat/movement-terrain.mjs";

const RACE = packDocById("packs-src/races/Другие_Ксеносы", "KcqfkjljcbTNVEAW");
const CLEVER = packDocById("packs-src/traits", "OvEMR1pCdDGL6jkJ");
const HARD = packDocById("packs-src/traits", "IsGR11cplUwRIuZv");
const SURE = packDocById("packs-src/traits", "RZ8eDsBa4H4r9l99");
const VOID = packDocById("packs-src/traits", "VoidInVeinsSqt01");

const entries = doc => doc.flags["warhammer-dbc"].mechanics.flatMap(g => g.entries);
const actorWith = items => ({ system: { race: "squat", characteristics: {}, conditions: {} }, items });

describe("раса Скват против книги", () => {
  it("Common Lore — любые 4; Trade — любые 2 +10", () => {
    const sk = entries(RACE).filter(e => e.kind === "skill");
    expect(sk.find(e => e.skillKey === "commonLore").specChoiceCount).toBe(4);
    expect(sk.find(e => e.skillKey === "trade")).toMatchObject({ specChoiceCount: 2, rank: "trained" });
  });

  it("Черты: есть Void in Veins, ссылка ведёт на существующий документ", () => {
    const tr = entries(RACE).find(e => (e.sourceName || "").startsWith("Void in Veins"));
    expect(tr.sourceUuid).toBe("Compendium.warhammer-dbc.traits.Item.VoidInVeinsSqt01");
    expect(VOID.name).toBe("Void in Veins / Пустота в Венах");
  });

  it("Архетипы — 7 книжных, с Благородным", () => {
    const keys = archetypesForRace("squat").map(([k]) => k).sort();
    expect(keys).toEqual(["apostate", "heresiarch", "noble", "pirate", "renegade", "savage", "witch"]);
  });
});

describe("Черты Сквата", () => {
  it("Надёжная Поступь: −1 SPD один раз (без остатка миграции) и Awareness в ландшафте", () => {
    expect((SURE.effects || []).some(e => e.system.changes.some(c => c.key === "system.speed"))).toBe(false);
    expect(entries(SURE).filter(e => e.kind === "movement").map(e => e.movementValue)).toEqual([-1]);
    expect(hasRuleFlag(actorWith([SURE]), SURE_TREAD_FLAG)).toBe(true);
  });

  it("Крепкий как Камень: лечение Астартес, мутации Астартес, Преимущество против яда", () => {
    const a = actorWith([HARD]);
    expect(hasRuleFlag(a, "healing.astartes")).toBe(true);
    expect(hasRuleFlag(a, "mutations.asAstartes")).toBe(true);
    expect(resolveTest({ actor: a, kind: "skill", char: "t", poisonTest: true }).rerolls).toHaveLength(1);
    expect(resolveTest({ actor: a, kind: "skill", char: "t" }).rerolls).toHaveLength(0);
  });

  it("мутации как у Космодесантника: после 10 Порчи следующий порог 30, а не 20", () => {
    const sys = { corruption: { value: 15 } };
    expect(nextMutationThreshold(sys)).toBe(20);
    expect(nextMutationThreshold(sys, { asAstartes: true })).toBe(30);
  });

  it("Умелые Руки: галочки +15 (и ещё +15) на Trade/Tech-Use/Security, не на Stealth", () => {
    const a = actorWith([CLEVER]);
    const tech = resolveTest({ actor: a, kind: "skill", skill: "techUse", char: "int" }).mods.map(m => m.value);
    expect(tech).toEqual([15, 15]);
    expect(resolveTest({ actor: a, kind: "skill", skill: "stealth", char: "ag" }).mods).toEqual([]);
    expect(resolveTest({ actor: a, kind: "skill", group: "trade", char: "int" }).mods).toHaveLength(2);
  });
});

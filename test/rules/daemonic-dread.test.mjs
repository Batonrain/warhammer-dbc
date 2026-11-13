// test/rules/daemonic-dread.test.mjs
//
// dbc-114 / 55-15 (13.11.2026): шаблон Черты «Демоническое Присутствие X/Y»
// сам выдаёт ауру: радиус = Y (rating2), штраф к W = ступень Daemonic Dread по X.

import "../support/foundry-stub.mjs";
import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { dreadTier, dreadUuidForRating, isDreadUuid, DREAD_ITEM_IDS } from "../../module/rules/daemonic-dread.mjs";
import { mechFormulaTotal } from "../../module/rules/mech-formula.mjs";

const PACK = "Compendium.warhammer-dbc.traits.Item.";
const traitFile = prefix => {
  const f = fs.readdirSync(path.resolve("packs-src/traits")).find(x => x.startsWith(prefix));
  return JSON.parse(fs.readFileSync(path.resolve("packs-src/traits", f), "utf8"));
};

describe("ступень Ужаса по X", () => {
  it("ближайшая кратная 5, от 5 до 20", () => {
    expect(dreadTier(1)).toBe(5);
    expect(dreadTier(5)).toBe(5);
    expect(dreadTier(7)).toBe(5);
    expect(dreadTier(8)).toBe(10);
    expect(dreadTier(10)).toBe(10);
    expect(dreadTier(15)).toBe(15);
    expect(dreadTier(20)).toBe(20);
    expect(dreadTier(35)).toBe(20);
  });
  it("0, пусто и нечисло — ступени нет", () => {
    expect(dreadTier(0)).toBeNull();
    expect(dreadTier(null)).toBeNull();
    expect(dreadTier("abc")).toBeNull();
  });
});

describe("dreadUuidForRating: только Ужасы, только при заданном X", () => {
  const ten = PACK + DREAD_ITEM_IDS[10];
  it("подменяет ступень по X", () => {
    expect(dreadUuidForRating(ten, 15)).toBe(PACK + DREAD_ITEM_IDS[15]);
    expect(dreadUuidForRating(ten, 5)).toBe(PACK + DREAD_ITEM_IDS[5]);
    expect(dreadUuidForRating(ten, 99)).toBe(PACK + DREAD_ITEM_IDS[20]);
  });
  it("без X (готовые существа бестиария) — запись как есть", () => {
    expect(dreadUuidForRating(ten, null)).toBe(ten);
    expect(dreadUuidForRating(ten, 0)).toBe(ten);
  });
  it("чужой uuid не трогает", () => {
    const other = PACK + "AAAAAAAAAAAAAAAA";
    expect(isDreadUuid(other)).toBe(false);
    expect(dreadUuidForRating(other, 15)).toBe(other);
  });
});

describe("id ступеней совпадают с настоящими предметами пака", () => {
  it("каждый id — это «Daemonic Dread» с нужным штрафом к W", () => {
    for (const [tier, id] of Object.entries(DREAD_ITEM_IDS)) {
      const f = fs.readdirSync(path.resolve("packs-src/traits")).find(x => x.endsWith(`_${id}.json`));
      expect(f, `предмет ${id} не найден в packs-src/traits`).toBeTruthy();
      const j = JSON.parse(fs.readFileSync(path.resolve("packs-src/traits", f), "utf8"));
      const val = (j.effects ?? []).flatMap(e => e.system?.changes || e.changes || [])
        .find(c => c.key === "system.characteristics.wp.totalFx")?.value;
      expect(Number(val)).toBe(-Number(tier));
    }
  });
});

describe("rating2 в формулах Конструктора", () => {
  it("«rating2» подставляется отдельно от «rating»", () => {
    expect(mechFormulaTotal("rating2", { rating: 3, rating2: 15 })).toBe(15);
    expect(mechFormulaTotal("rating", { rating: 3, rating2: 15 })).toBe(3);
    expect(mechFormulaTotal("rating + rating2", { rating: 3, rating2: 15 })).toBe(18);
  });
});

describe("шаблон «Демоническое Присутствие» несёт ауру (пак-данные)", () => {
  it("запись kind:aura: радиус по rating2, ступень по rating, на врагов, с иммунитетами", () => {
    const j = traitFile("Daemonic_Presence___");
    const e = j.flags["warhammer-dbc"].mechanics.flatMap(g => g.entries).find(x => x.kind === "aura");
    expect(e).toBeTruthy();
    expect(e.auraRadius).toBe("rating2");
    expect(e.rating).toBe("rating");
    expect(e.auraAffects).toBe("enemies");
    expect(isDreadUuid(e.sourceUuid)).toBe(true);
    expect(e.auraImmuneTraits).toContain("From Beyond");
  });
});

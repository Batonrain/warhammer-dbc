// test/migrations/hominis-frame.test.mjs
//
// Sahara 588-551f: Электрожрец, созданный до появления записи «Фрейм Хоминис»,
// без Черты гасит весь Архетип. Проход выдаёт её. Данные — настоящие JSON packs-src.

import "../support/foundry-stub.mjs";
import { describe, it, expect } from "vitest";
import { allPackDocuments } from "../support/pack-docs.mjs";
import {
  buildHominisContext, hominisFrameData, hominisAppliedUpdate, hasHominisTrait
} from "../../module/migrations/hominis-frame.mjs";

const TRAIT_ID = "HominisFrame0001";
const ARCH_ID = "yybk1faGxSF2volp";
const find = (pack, id) => allPackDocuments(pack).find(d => d.doc._id === id).doc;
const trait = { ...find("traits", TRAIT_ID), uuid: `Compendium.warhammer-dbc.traits.Item.${TRAIT_ID}` };
const archetype = { ...find("elite-archetypes", ARCH_ID), id: ARCH_ID };
const CTX = buildHominisContext([trait, archetype]);
const arch = (flags = {}) => ({ id: "A1", type: "eliteArchetype", name: archetype.name, system: {}, flags });

describe("Фрейм Хоминис у уже созданных Электрожрецов", () => {
  it("контекст находит Черту и запись архетипа, которая её выдаёт", () => {
    expect(CTX).not.toBeNull();
    expect(CTX.entryId).toBe("PuRQjJI0GnZfQAEV");
  });

  it("Электрожрец без Черты получает её с метками выдачи архетипа", () => {
    const data = hominisFrameData([arch()], CTX);
    expect(data.type).toBe("trait");
    expect(data._id).toBeUndefined();
    expect(data.flags["warhammer-dbc"]).toMatchObject({ grantedByItem: "A1", abilityEntryId: "PuRQjJI0GnZfQAEV" });
  });

  it("идемпотентно: Черта уже есть — ничего", () => {
    const items = [arch(), { id: "T", type: "trait", name: trait.name, system: {}, flags: {} }];
    expect(hasHominisTrait(items)).toBe(true);
    expect(hominisFrameData(items, CTX)).toBeNull();
  });

  it("стоит другой Фрейм — Хоминис не выдаётся", () => {
    const items = [arch(), { id: "F", type: "trait", name: "Paladin Frame / Фрейм Паладина", system: {}, flags: {} }];
    expect(hominisFrameData(items, CTX)).toBeNull();
  });

  it("не Электрожрец — ничего", () => {
    const other = { id: "B", type: "eliteArchetype", name: "Berzerker / Берсерк Кхорна", system: {}, flags: {} };
    expect(hominisFrameData([other], CTX)).toBeNull();
  });

  it("запись помечается применённой, чтобы «Обновить мир» не выдал вторую", () => {
    expect(hominisAppliedUpdate([arch({ "warhammer-dbc": { mechanicsApplied: ["x"] } })], CTX))
      .toEqual({ _id: "A1", "flags.warhammer-dbc.mechanicsApplied": ["x", "PuRQjJI0GnZfQAEV"] });
    expect(hominisAppliedUpdate([arch({ "warhammer-dbc": { mechanicsApplied: true } })], CTX)).toBeNull();
  });
});

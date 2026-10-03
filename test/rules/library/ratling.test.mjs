// test/rules/library/ratling.test.mjs
//
// Сверка расы Ратлинг с корбуком (глава I): Trade (Cook + любое 1) и книжные
// списки Архетипов (Ратлинг 7, Огрин 3). Перенесено из PR #528 (6b2f2717a),
// адаптировано к main: список Архетипов лежит в `system.archetypes` расы.
// Коротышка, Босоногий и Ловит на Лету в main устроены иначе и покрыты
// test/rules/ratling.test.mjs.

import { describe, it, expect } from "vitest";
import "../../support/foundry-stub.mjs";
import { packDocById } from "../../support/pack-doc.mjs";
import { archetypesForRace } from "../../../module/apps/archetypes.mjs";

const RACE = packDocById("packs-src/races/Люди", "L5v7S3jLjyupDVJq");
const OGRYN = packDocById("packs-src/races/Люди", "tjQaSHFHxbt1tvWU");

const entries = doc => doc.flags["warhammer-dbc"].mechanics.flatMap(g => g.entries);

describe("раса Ратлинг против книги", () => {
  it("Trade: Cook постоянно + любое 1 (без Cook в выборе)", () => {
    const trade = entries(RACE).filter(e => e.kind === "skill" && e.skillKey === "trade");
    expect(trade.find(e => e.specKey === "cook")).toBeTruthy();
    const choice = trade.find(e => e.specKey === "__choice__");
    expect(choice.specChoiceCount).toBe(1);
    expect(choice.specChoiceKeys).not.toContain("cook");
  });

  it("Архетипы — только книжный список (Ратлинг 7, Огрин 3)", () => {
    expect(RACE.system.archetypes).toEqual(["apostate", "heresiarch", "renegade", "pirate", "savage", "witch", "numen"]);
    expect(OGRYN.system.archetypes).toEqual(["renegade", "pirate", "savage"]);
  });

  it("фильтр Архетипов: Огрину нет Благородного и Ведьмы, Человеку — всё", () => {
    const ogryn = archetypesForRace("ogryn").map(([k]) => k);
    expect(ogryn.sort()).toEqual(["pirate", "renegade", "savage"]);
    const ratling = archetypesForRace("ratling").map(([k]) => k);
    expect(ratling).toContain("numen");
    expect(ratling).not.toContain("noble");
    expect(archetypesForRace("human").map(([k]) => k)).toContain("noble");
  });
});

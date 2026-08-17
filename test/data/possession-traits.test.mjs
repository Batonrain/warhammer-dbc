// test/data/possession-traits.test.mjs
//
// Одержимость скакуна и байка выдаёт сосуду Трейты Daemonic (W.b демона) и
// Stuff of Nightmares (корбук стр. 478). Черты ищутся В ПАКЕ ПО НАЧАЛУ ИМЕНИ
// (apps/veil.mjs, _grantPossessionTraits), и переименование в паке сломало бы
// выдачу молча: ритуал прошёл бы, свойства записались, а Трейтов не появилось.
//
// Пак у сосудов разный, и это не дублирование ради дублирования: лист техники
// отбирает Черты строго по типу `vehicleTrait` (sheets/vehicle-sheet.mjs), и
// Черта существа на байке не показалась бы вовсе.

import { describe, it, expect } from "vitest";
import { packDocuments } from "../support/pack-docs.mjs";

/** Начала имён, по которым veil.mjs ищет Черты, и тип предмета в каждом паке. */
const WANTED = {
  traits: {
    type: "trait",
    starts: ["Daemonic /", "Stuff of Nightmares"]
  },
  "vehicle-traits": {
    type: "vehicleTrait",
    starts: ["Демонический (", "Существо из Кошмаров"]
  }
};

describe("Черты Одержимости лежат в паках под ожидаемыми именами", () => {
  for (const [pack, { type, starts }] of Object.entries(WANTED)) {
    for (const prefix of starts) {
      it(`${pack}: «${prefix}…»`, () => {
        const found = packDocuments(pack, type).filter(({ doc }) => String(doc.name).startsWith(prefix));
        expect(found).toHaveLength(1);
        expect(found[0].doc.type).toBe(type);
      });
    }
  }

  // «Демоническая Одержимость» — ДРУГОЕ правило (демоническое ядро: щит-
  // дефлектор и иммунитет экипажа к критам), и путать её с Daemonic нельзя:
  // поиск по подстроке «Daemonic» нашёл бы обе.
  it("Daemonic и Daemonic Possession — разные Черты техники", () => {
    const docs = packDocuments("vehicle-traits", "vehicleTrait").map(({ doc }) => doc);
    const daemonic = docs.find(d => d.name.startsWith("Демонический ("));
    const possession = docs.find(d => d.name.startsWith("Демоническая Одержимость"));
    expect(possession).toBeTruthy();
    expect(daemonic.name).not.toBe(possession.name);
    expect(possession.system.effects.deflectorShield).toBe(true);
    expect(daemonic.system.hasRating).toBe(true);
  });
});

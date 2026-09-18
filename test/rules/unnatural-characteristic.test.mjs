// test/rules/unnatural-characteristic.test.mjs
//
// Сверхъестественная Характеристика (стр. 26) — рейтинг X по книжному
// примеру (Unnatural S (4) → +2 Успеха), без Foundry.

import { describe, it, expect } from "vitest";
import { unnaturalRating, unnaturalDegreeBonus, hasUnnaturalCharacteristic }
  from "../../module/rules/unnatural-characteristic.mjs";

const trait = (name, stat, value) => ({
  type: "trait", name, system: { effects: { charBonuses: [{ stat, value }] } }
});
const legacyTrait = (name, stat, value) => ({
  type: "trait", name, system: { effects: { charBonusStat: stat, charBonusValue: value } }
});

describe("unnaturalRating", () => {
  it("пример книги: Unnatural S (4) у Аркилана", () => {
    const actor = { items: [trait("Unnatural S (4) / Сверхъест. Сила", "s", 4)] };
    expect(unnaturalRating(actor, "s")).toBe(4);
  });

  it("не путает Характеристики: рейтинг S не течёт в T", () => {
    const actor = { items: [trait("Unnatural S (4) / Сверхъест. Сила", "s", 4)] };
    expect(unnaturalRating(actor, "t")).toBe(0);
  });

  it("складывает несколько источников для одной Характеристики", () => {
    const actor = { items: [
      trait("Unnatural WP (+2) / Сверхъест. Воля", "wp", 2),
      trait("Unnatural Willpower (+4) / Сверхъест. Воля", "wp", 4)
    ] };
    expect(unnaturalRating(actor, "wp")).toBe(6);
  });

  it("поддерживает досрочную пару charBonusStat/charBonusValue (до миграции в charBonuses)", () => {
    const actor = { items: [legacyTrait("Unnatural T (4) / Сверхъест. Стойкость", "t", 4)] };
    expect(unnaturalRating(actor, "t")).toBe(4);
  });

  it("Daemonic (X) НЕ считается Unnatural — своё правило по тексту пака, без бонуса степени", () => {
    const actor = { items: [trait("Daemonic / Демонический (X)", "t", 1)] };
    expect(unnaturalRating(actor, "t")).toBe(0);
  });

  it("предметы других типов (импланты) с тем же полем не считаются", () => {
    const actor = { items: [{ type: "implant", name: "Bionic Arm (Legion) / Бионическая Рука",
      system: { effects: { charBonuses: [{ stat: "s", value: 4 }] } } }] };
    expect(unnaturalRating(actor, "s")).toBe(0);
  });

  it("Unnatural Senses — другой трейт (не характеристика), charBonuses пуст, вклада нет", () => {
    const actor = { items: [{ type: "trait", name: "Unnatural Senses / Сверхъестественные Чувства (X)",
      system: { effects: { charBonuses: [] } } }] };
    expect(unnaturalRating(actor, "per")).toBe(0);
  });

  it("без актора/ключа не падает", () => {
    expect(unnaturalRating(null, "s")).toBe(0);
    expect(unnaturalRating({ items: [] }, null)).toBe(0);
  });
});

describe("unnaturalDegreeBonus", () => {
  it("книжный пример: Unnatural S (4) → +2 Успеха", () => {
    expect(unnaturalDegreeBonus(4)).toBe(2);
  });

  it("округление вниз до полных 2: 5 → +2, не +3", () => {
    expect(unnaturalDegreeBonus(5)).toBe(2);
  });

  it("рейтинг 1 или 0 — бонуса нет", () => {
    expect(unnaturalDegreeBonus(1)).toBe(0);
    expect(unnaturalDegreeBonus(0)).toBe(0);
  });

  it("Unnatural W (2) от Метки Тзинча (пример 2 книги) → +1 Успех", () => {
    expect(unnaturalDegreeBonus(2)).toBe(1);
  });
});

describe("hasUnnaturalCharacteristic", () => {
  it("true, если рейтинг больше нуля", () => {
    const actor = { items: [trait("Unnatural W (2) / Сверхъест. Воля", "wp", 2)] };
    expect(hasUnnaturalCharacteristic(actor, "wp")).toBe(true);
  });

  it("false без соответствующего трейта", () => {
    const actor = { items: [] };
    expect(hasUnnaturalCharacteristic(actor, "wp")).toBe(false);
  });
});

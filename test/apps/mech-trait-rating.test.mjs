// test/apps/mech-trait-rating.test.mjs
//
// Черта-шаблон «(X)» несёт эффект, равный своему рейтингу: Демонический (1),
// Страх (2), Машина (3), Естественная Броня (2), Сверхъест. Сила (1),
// Сверхъест. Стойкость (1) — все шесть параметрических Черт пака с эффектами.
// Значит выдача с другим рейтингом обязана двигать и эффект, иначе рейтинг
// остаётся только в тексте, а «Сверхъест. Сила (4)» даёт +1.

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { rescaleTraitByRating } from "../../module/apps/mechanics.mjs";
import { packDocuments } from "../support/pack-docs.mjs";

/** Копия документа Черты в том виде, в каком её отдаёт src.toObject(). */
const traitDoc = (rating, changes, effects = {}) => ({
  name: "Проба (X)", type: "trait",
  system: {
    hasRating: true, rating,
    effects: { charBonusStat: "", charBonusValue: 0, charBonuses: [],
               charValueBonuses: [], armourAll: 0, fearRating: 0, sizeMod: 0,
               initMod: 0, speedMod: 0, ...effects }
  },
  effects: [{ name: "Проба", system: { changes: changes.map(v => ({
    key: "system.characteristics.s.bonusFx", type: "add", value: v, phase: "initial", priority: 0
  })) } }]
});

const changeValues = d => d.effects.flatMap(e => e.system.changes.map(c => c.value));

describe("рейтинг Черты двигает её эффект", () => {

  it("эффект, равный рейтингу шаблона, становится новым рейтингом", () => {
    const doc = rescaleTraitByRating(traitDoc(1, [1]), 4);

    expect(changeValues(doc)).toEqual([4]);
  });

  it("старое поле system.effects пересчитывается вместе с ActiveEffect", () => {
    const doc = rescaleTraitByRating(
      traitDoc(2, [2], { charBonusStat: "t", charBonusValue: 2, armourAll: 2 }), 5);

    expect(doc.system.effects.charBonusValue).toBe(5);
    expect(doc.system.effects.armourAll).toBe(5);
  });

  // Не всякое число в Черте — рейтинг. Трогаем только совпавшие с ним.
  it("числа, не равные рейтингу шаблона, остаются как были", () => {
    const doc = rescaleTraitByRating(traitDoc(2, [2, 10]), 5);

    expect(changeValues(doc)).toEqual([5, 10]);
  });

  it("без рейтинга шаблона или при том же рейтинге ничего не меняется", () => {
    expect(changeValues(rescaleTraitByRating(traitDoc(0, [1]), 4))).toEqual([1]);
    expect(changeValues(rescaleTraitByRating(traitDoc(3, [3]), 3))).toEqual([3]);
    expect(changeValues(rescaleTraitByRating(traitDoc(3, [3]), 0))).toEqual([3]);
  });

  // Живые данные: то, ради чего всё затевалось.
  it("«Сверхъест. Сила (X)» из пака с рейтингом 4 даёт +4 к бонусу Силы", () => {
    const { doc } = packDocuments("traits", "trait")
      .find(d => /Unnatural Strength/.test(d.doc.name));
    const scaled = rescaleTraitByRating(structuredClone(doc), 4);
    const change = scaled.effects[0].system.changes
      .find(c => c.key === "system.characteristics.s.bonusFx");

    expect(change.value).toBe(4);
  });
});

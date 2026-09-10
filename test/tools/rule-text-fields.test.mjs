// test/tools/rule-text-fields.test.mjs
//
// wdbc-dj0r: замер «пустых карточек» держал один плоский список полей на все
// типы и дважды завысил долг — у оружия правило живёт в system.weaponProps
// (список, не текст), у болезней — в четырёх отдельных полях, не в тексте.
// Карта «тип → доп. поля» точнее, но остаётся ручной — полная автоматизация
// от схемы не вышла (StringField не отличает прозу от короткого кода поля).

import { describe, it, expect } from "vitest";
import { hasRuleText, textFieldsFor, COMMON_TEXT_FIELDS, TEXT_FIELDS_BY_TYPE } from "../../tools/rule-text-fields.mjs";

describe("textFieldsFor", () => {
  it("неизвестный/общий тип — только общий список", () => {
    expect(textFieldsFor("mutation")).toEqual(COMMON_TEXT_FIELDS);
    expect(textFieldsFor(undefined)).toEqual(COMMON_TEXT_FIELDS);
  });

  it("weapon — общий список плюс weaponProps", () => {
    expect(textFieldsFor("weapon")).toEqual([...COMMON_TEXT_FIELDS, "weaponProps"]);
  });

  it("disease — общий список плюс четыре поля болезни", () => {
    expect(textFieldsFor("disease")).toEqual([...COMMON_TEXT_FIELDS, ...TEXT_FIELDS_BY_TYPE.disease]);
  });
});

describe("hasRuleText", () => {
  it("нет documenta/system — false", () => {
    expect(hasRuleText(null)).toBe(false);
    expect(hasRuleText({ type: "weapon" })).toBe(false);
  });

  it("оружие: пустой effect, но непустой weaponProps — считается непустым (wdbc-dj0r, было завышение долга)", () => {
    const doc = { type: "weapon", system: { effect: "", weaponProps: [{ key: "blast", value: 3 }] } };
    expect(hasRuleText(doc)).toBe(true);
  });

  it("оружие: пустой effect И пустой weaponProps — считается пустым", () => {
    const doc = { type: "weapon", system: { effect: "", weaponProps: [] } };
    expect(hasRuleText(doc)).toBe(false);
  });

  it("болезнь: текст только в symptoms — считается непустой (wdbc-dj0r, было завышение долга)", () => {
    const doc = { type: "disease", system: { description: "", symptoms: "Жар и кашель" } };
    expect(hasRuleText(doc)).toBe(true);
  });

  it("болезнь: все четыре поля пустые — считается пустой", () => {
    const doc = { type: "disease", system: { incubation: "", symptoms: "", vectors: "", cure: "" } };
    expect(hasRuleText(doc)).toBe(false);
  });

  it("обычный тип: текст в benefit — непустой; HTML-теги без текста — пустой", () => {
    expect(hasRuleText({ type: "talent", system: { benefit: "Даёт бонус" } })).toBe(true);
    expect(hasRuleText({ type: "talent", system: { benefit: "<p></p>" } })).toBe(false);
  });

  it("weaponProps не заводит ложных попаданий у НЕ-оружия — доп. поле только по своему типу", () => {
    const doc = { type: "talent", system: { benefit: "", weaponProps: [{ key: "blast" }] } };
    expect(hasRuleText(doc)).toBe(false);
  });
});

// test/rules/regeneration-sources.test.mjs
// Sahara task-4ae5: особые источники Регенерации — психосила Regeneration
// (Regeneration (PR), тесты T +2×PR) и Целительный Прожектор Мейстера (бонус к
// следующему тесту T по Стадии Пакта). Дар Одержимого — Cor+0 (уже было).
import { describe, it, expect } from "vitest";
import {
  regenerationSource, sustainedRegenerationEpr, regenerationTestBonus, projectorRegenValue, PROJECTOR_REGEN_FLAG
} from "../../module/rules/rubric-sorcerer.mjs";
import { lifeVirusRow } from "../../module/rules/maester-talents.mjs";

const power = (sustained, epr = null) => ({
  type: "psychicPower", name: "Regeneration / Регенерация", system: { isSustained: sustained, sustainedEpr: epr }
});
const actor = (items = [], flags = {}) => ({ system: { psyker: { rating: 5, currentRating: 6 } }, items, flags: { "warhammer-dbc": flags } });

describe("психосила Regeneration", () => {
  it("пока поддерживается — Regeneration (эPR), тест T", () => {
    expect(regenerationSource(actor([power(true, 7)]))).toEqual({ rating: 7, test: "t" });
    expect(sustainedRegenerationEpr(actor([power(true)]))).toBe(6);
  });
  it("не поддерживается — ничего", () => {
    expect(regenerationSource(actor([power(false, 7)])).rating).toBe(0);
    expect(regenerationTestBonus(actor([power(false, 7)])).mod).toBe(0);
  });
  it("тест T получает +2×PR", () => {
    expect(regenerationTestBonus(actor([power(true, 7)]))).toMatchObject({ mod: 14, auto: false });
  });
  it("Черта сильнее силы — рейтинг Черты, бонус силы остаётся", () => {
    const a = actor([power(true, 5), { type: "trait", name: "Regeneration (8)", system: {} }]);
    expect(regenerationSource(a).rating).toBe(8);
    expect(regenerationTestBonus(a).mod).toBe(10);
  });
});

describe("Целительный Прожектор (Стадии Пакта Мейстера)", () => {
  it("таблица «Бонус регенерации» → метка", () => {
    expect(projectorRegenValue(lifeVirusRow(0).regenBonus)).toBe(null);
    expect(projectorRegenValue(lifeVirusRow(1).regenBonus)).toBe(10);
    expect(projectorRegenValue(lifeVirusRow(4).regenBonus)).toBe(30);
    expect(projectorRegenValue(lifeVirusRow(5).regenBonus)).toBe("auto");
  });
  it("метка даёт бонус или автоуспех к тесту T", () => {
    expect(regenerationTestBonus(actor([], { [PROJECTOR_REGEN_FLAG]: 15 }))).toMatchObject({ mod: 15, projector: true, auto: false });
    expect(regenerationTestBonus(actor([], { [PROJECTOR_REGEN_FLAG]: "auto" }))).toMatchObject({ auto: true, projector: true });
  });
  it("складывается с психосилой", () => {
    expect(regenerationTestBonus(actor([power(true, 5)], { [PROJECTOR_REGEN_FLAG]: 20 })).mod).toBe(30);
  });
});

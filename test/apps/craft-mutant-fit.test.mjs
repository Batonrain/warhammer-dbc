// Доводка брони под мутанта (core, «Броня и Мутации», Sahara wdbc-x1nz-4):
// тест как на крафт брони +10, Банк по своей таблице книги, Качество множит как
// обычно; реквизиция брони на заказ под мутанта — Редкость +1.
import { describe, it, expect, beforeEach } from "vitest";
import "../support/foundry-stub.mjs";
import { CraftWorkshop } from "../../module/apps/craft-workshop.mjs";
import { mutantFitBaseBank, mutantFitApplies } from "../../module/constants/craft.mjs";
import { requisitionPlan } from "../../module/rules/requisition.mjs";

const crafter = {
  id: "c1", name: "Бронник", items: [],
  system: { characteristics: { int: { total: 40 } }, skills: { techUse: { total: 50, rank: "trained" } },
    groupSkills: { trade: [{ name: "Armourer", total: 45, rank: "trained" }] }, fatigue: { value: 0 } }
};

function app(over = {}) {
  const a = Object.create(CraftWorkshop.prototype);
  a.projects = [{
    id: "p1", title: "", mode: "craft", crafterId: "c1", categoryKey: "armor",
    rarity: 3, quality: "common", toolKey: "common", gmMod: 0, assistants: 0, baseBank: null,
    improve: false, monotony: false, diceMode: "normal", skillChoices: {},
    project: { accumulated: 0, shifts: 0, fatigue: 0 }, ...over
  }];
  return a;
}

beforeEach(() => { globalThis.game.actors = { get: id => (id === "c1" ? crafter : null) }; });

describe("таблица Банка доводки", () => {
  it("R1 и меньше 5, R2 10, R3 25, R4 90, R5 250", () => {
    expect([-3, 0, 1, 2, 3, 4, 5].map(mutantFitBaseBank)).toEqual([5, 5, 5, 10, 25, 90, 250]);
  });
  it("только Крафт брони без Ремонта", () => {
    expect(mutantFitApplies({ mutantFit: true, mode: "craft", categoryKey: "powerArmor" })).toBe(true);
    expect(mutantFitApplies({ mutantFit: true, mode: "craft", categoryKey: "firearm" })).toBe(false);
    expect(mutantFitApplies({ mutantFit: true, mode: "craft", repair: true, categoryKey: "armor" })).toBe(false);
  });
});

describe("Мастерская: проект с галочкой «Доводка под мутанта»", () => {
  it("+10 к Пределу и Банк 25 вместо табличных 150 у брони R3", () => {
    const plain = app()._resolve(app().projects[0]);
    const a = app({ mutantFit: true });
    const fit = a._resolve(a.projects[0]);
    expect(plain.bank).toBe(150);
    expect(fit.bank).toBe(25);
    expect(fit.combined.limit - plain.combined.limit).toBe(10);
  });
  it("Качество множит Банк как обычно: Good.Q ×4", () => {
    const a = app({ mutantFit: true, quality: "good" });
    expect(a._resolve(a.projects[0]).bank).toBe(100);
  });
  it("Улучшение с доводкой не складывается", () => {
    const a = app({ mutantFit: true, improve: true });
    const r = a._resolve(a.projects[0]);
    expect(r.bank).toBe(25);
    expect(r.mods.improveMod).toBe(0);
  });
});

describe("реквизиция брони на заказ под мутанта", () => {
  it("Редкость +1", () => {
    const base = requisitionPlan(null, { name: "Панцирь", rarity: 1 });
    const fit = requisitionPlan(null, { name: "Панцирь", rarity: 1, mutantFit: true });
    expect(fit.rarity).toBe(base.rarity + 1);
    expect(fit.shifts.some(s => s.id === "mutantFit")).toBe(true);
  });
});

// test/sheets/character-context-stance-options.test.mjs
//
// Панель «Стойка» на вкладке БОЙ (character-context.mjs::combatStanceOptions,
// templates/actor/parts/tab-combat.hbs) показывала ВСЕ Стойки без фильтра —
// игрок мог поставить Частокол без древкового оружия или Агрессивную без
// Рукопашной Тренировки, хотя тот же выбор в диалоге атаки такие варианты уже
// прятал (module/sheets/attack/selection.mjs::computeStanceOptions). Теперь
// панель БОЙ фильтрует так же, через общий module/rules/melee-stance-gate.mjs.

import { describe, it, expect } from "vitest";
import { sheetOf } from "../support/foundry-stub.mjs";
import { WarhammerCharacterSheet } from "../../module/sheets/actor-sheet.mjs";
import { characterContext } from "../../module/sheets/character-context.mjs";

const sword = { id: "w1", type: "weapon", system: { equipped: true, weaponClass: "melee", meleeCategory: "Меч" }, getFlag: () => undefined };
const spear = { id: "w1", type: "weapon", system: { equipped: true, weaponClass: "melee", meleeCategory: "Копьё" }, getFlag: () => undefined };
const swordTraining = { id: "t1", type: "talent", name: "Melee Training / Рукопашная Тренировка", system: { specialization: "Меч" }, getFlag: () => undefined };
const spearTraining = { id: "t1", type: "talent", name: "Melee Training / Рукопашная Тренировка", system: { specialization: "Копьё" }, getFlag: () => undefined };

function stanceKeys(items, system = {}) {
  const sheet = sheetOf(WarhammerCharacterSheet, { items, characteristics: {}, skills: {}, groupSkills: {}, ...system });
  sheet.actor.items.contents = sheet.actor.items;
  return characterContext(sheet.actor).combatStanceOptions.map(s => s.key);
}

describe("combatStanceOptions: панель БОЙ фильтрует Стойки так же, как диалог атаки", () => {
  it("без оружия — Частокол недоступен (неизвестная категория не даёт мягкого пропуска), остальные — как и в диалоге атаки, мягко доступны", () => {
    const keys = stanceKeys([]);
    expect(keys).not.toContain("rapidstrike");
    expect(keys).toContain("standard");
  });

  it("Меч без Тренировки — всё ещё только Стандартная (стр. 62)", () => {
    expect(stanceKeys([sword])).toEqual(["standard"]);
  });

  it("Меч + Тренировка Мечом — Агрессивная/Защитная/Прикрывающая доступны, Частокол — нет", () => {
    const keys = stanceKeys([sword, swordTraining]);
    expect(keys).toContain("aggressive");
    expect(keys).toContain("defensive");
    expect(keys).toContain("covering");
    expect(keys).not.toContain("rapidstrike");
  });

  it("Копьё + Тренировка Копьём — Частокол тоже доступен", () => {
    const keys = stanceKeys([spear, spearTraining]);
    expect(keys).toContain("rapidstrike");
  });

  it("верхом — доступна только Стандартная, даже с Тренировкой", () => {
    const keys = stanceKeys([sword, swordTraining], { mount: { uuid: "Actor.x" } });
    expect(keys).toEqual(["standard"]);
  });

  it("уже выбранная (персистентная) Стойка остаётся видна, даже если оружие сменилось и она больше недоступна", () => {
    // meleeStance:"rapidstrike" на акторе, но экипирован Меч (не древковое) —
    // без спецрегрессии игрок не увидел бы, что стоит в недоступной Стойке.
    const withoutFlag = stanceKeys([sword, swordTraining]);
    expect(withoutFlag).not.toContain("rapidstrike"); // без флага — скрыт, как обычно

    const keys = stanceKeys([sword, swordTraining], { meleeStance: "rapidstrike" });
    expect(keys).toContain("rapidstrike"); // с флагом meleeStance — виден, несмотря на недоступность
  });
});

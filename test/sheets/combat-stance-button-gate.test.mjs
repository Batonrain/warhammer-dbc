// test/sheets/combat-stance-button-gate.test.mjs
//
// Клик по кнопке Стойки на вкладке БОЙ (.technique-btn-stance) писал
// system.meleeStance без всякой проверки — второй рубеж (на случай
// устаревшего рендера листа у другого клиента, тот же принцип, что у
// stanceLocked) отсутствовал. Теперь клик по недоступной Стойке отклоняется,
// как и заранее отфильтрованный список в character-context.mjs.

import "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach } from "vitest";
import { activateCombatListeners } from "../../module/sheets/tabs/combat.mjs";

function fakeButton(selector, stance) {
  const listeners = {};
  return {
    dataset: { stance },
    matches: sel => sel === selector,
    addEventListener: (event, handler) => { listeners[event] = handler; },
    click: () => listeners.click?.({ currentTarget: { dataset: { stance } } })
  };
}

function fakeRoot(elements) {
  return { querySelectorAll: selector => elements.filter(el => el.matches(selector)) };
}

function actorWith(items, updates = []) {
  const list = [...items];
  list.get = id => list.find(i => i.id === id) ?? null;
  return {
    items: list, system: {},
    update: async data => updates.push(data)
  };
}

beforeEach(() => {
  globalThis.ui = { ...globalThis.ui, notifications: { warn: () => {}, info: () => {}, error: () => {} } };
});

describe("вкладка Бой: клик по кнопке Стойки проверяет доступность (второй рубеж)", () => {
  it("Частокол без древкового оружия — клик отклонён, meleeStance не меняется", () => {
    const sword = { id: "w1", type: "weapon", system: { equipped: true, weaponClass: "melee", meleeCategory: "Меч" } };
    const updates = [];
    const actor = actorWith([sword], updates);
    const btn = fakeButton(".technique-btn-stance", "rapidstrike");
    activateCombatListeners(fakeRoot([btn]), actor);

    btn.click();

    expect(updates).toHaveLength(0);
  });

  it("Стандартная доступна всегда — клик проходит", () => {
    const actor = actorWith([]);
    const btn = fakeButton(".technique-btn-stance", "standard");
    let updated = null;
    actor.update = async data => { updated = data; };
    activateCombatListeners(fakeRoot([btn]), actor);

    btn.click();

    expect(updated).toEqual({ "system.meleeStance": "standard" });
  });

  it("Частокол с экипированным Копьём — клик проходит", () => {
    const spear = { id: "w1", type: "weapon", system: { equipped: true, weaponClass: "melee", meleeCategory: "Копьё" } };
    const spearTraining = { id: "t1", type: "talent", name: "Melee Training / Рукопашная Тренировка", system: { specialization: "Копьё" } };
    const actor = actorWith([spear, spearTraining]);
    let updated = null;
    actor.update = async data => { updated = data; };
    const btn = fakeButton(".technique-btn-stance", "rapidstrike");
    activateCombatListeners(fakeRoot([btn]), actor);

    btn.click();

    expect(updated).toEqual({ "system.meleeStance": "rapidstrike" });
  });
});

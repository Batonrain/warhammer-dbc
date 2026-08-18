// test/sheets/combat.test.mjs
//
// Вкладка БОЙ: кнопки атаки у дальнобойного оружия. Раньше единственный путь
// бросить атаку без цели был спрятан за скрытой горячей клавишей Пробел
// внутри прицеливания (module/combat/aim.mjs, beginTargeting). Кнопка
// «Без цели» открывает тот же диалог атаки напрямую, минуя перекрестие.

import "../support/foundry-stub.mjs";
import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.mock поднимается над импортами — моки заводятся через vi.hoisted, иначе
// обращение к обычной const внутри фабрики роняется как «before initialization».
const { showAttackDialog, beginTargeting } = vi.hoisted(() => ({
  showAttackDialog: vi.fn(),
  beginTargeting:   vi.fn()
}));

vi.mock("../../module/sheets/attack-dialog.mjs", () => ({
  showAttackDialog,
  showAttackDialogWithTechnique: vi.fn(),
  showAttackDialogNoWeapon: vi.fn()
}));
vi.mock("../../module/combat/aim.mjs", () => ({ beginTargeting }));

import { activateCombatListeners } from "../../module/sheets/tabs/combat.mjs";

/** Мини-DOM: только то, что использует on() из module/helpers/utils.mjs. */
function fakeButton(selector, itemId) {
  const listeners = {};
  return {
    dataset: { itemId },
    matches: sel => sel === selector,
    addEventListener: (event, handler) => { listeners[event] = handler; },
    click: () => listeners.click?.({ currentTarget: { dataset: { itemId } } })
  };
}

function fakeRoot(elements) {
  return { querySelectorAll: selector => elements.filter(el => el.matches(selector)) };
}

function actorWith(item) {
  return { items: { get: id => (id === item.id ? item : null) }, update: vi.fn() };
}

beforeEach(() => {
  showAttackDialog.mockClear();
  beginTargeting.mockClear();
  globalThis.game = { user: { targets: new Set() } };
  globalThis.canvas = { ready: true };
});

describe("вкладка Бой: кнопки атаки дальнобойного оружия", () => {
  it("«Атака» без выбранной цели у дальнобойного оружия уходит в прицеливание", () => {
    const item = { id: "w1", system: { weaponClass: "basic" } };
    const btn  = fakeButton(".weapon-attack-roll", "w1");
    activateCombatListeners(fakeRoot([btn]), actorWith(item));

    btn.click();

    expect(beginTargeting).toHaveBeenCalledTimes(1);
    expect(showAttackDialog).not.toHaveBeenCalled();
  });

  it("«Без цели» открывает диалог атаки напрямую, минуя прицеливание", () => {
    const item = { id: "w1", system: { weaponClass: "basic" } };
    const btn  = fakeButton(".weapon-attack-notarget", "w1");
    const actor = actorWith(item);
    activateCombatListeners(fakeRoot([btn]), actor);

    btn.click();

    expect(beginTargeting).not.toHaveBeenCalled();
    expect(showAttackDialog).toHaveBeenCalledTimes(1);
    expect(showAttackDialog).toHaveBeenCalledWith(actor, item);
  });

  it("«Без цели» на несуществующем предмете ничего не делает", () => {
    const btn = fakeButton(".weapon-attack-notarget", "missing");
    activateCombatListeners(fakeRoot([btn]), actorWith({ id: "w1", system: {} }));

    btn.click();

    expect(showAttackDialog).not.toHaveBeenCalled();
  });
});

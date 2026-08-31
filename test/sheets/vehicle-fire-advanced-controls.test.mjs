// test/sheets/vehicle-fire-advanced-controls.test.mjs
//
// wdbc-y33b (доводка, «всё равно попробовать»): Продвинутые Системы
// Управления — движение техники нигде не отслеживается как «действие» в
// этой системе (ни для одной машины, не только с этой Чертой), поэтому
// честная автоматизация ограничена: выстрел из Закреплённого орудия сам
// отмечает флаг system.movedThisTurn (сбрасывается вручную каждый Раунд),
// без реальной траты/проверки «действия на движение», которого не существует.

import "../support/foundry-stub.mjs";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { captured, resetCaptured, fakeForm } from "../support/foundry-stub.mjs";

const { _executeAttackRoll } = vi.hoisted(() => ({ _executeAttackRoll: vi.fn() }));
vi.mock("../../module/combat/attack.mjs", () => ({ _executeAttackRoll }));

import { WarhammerVehicleSheet } from "../../module/sheets/vehicle-sheet.mjs";

function sheetLike(actor) {
  return Object.assign(Object.create(WarhammerVehicleSheet.prototype), { actor });
}

function vehicle(traitFlags = {}, movedThisTurn = false) {
  const updates = [];
  return {
    name: "Хищник", uuid: "Actor.vehicle",
    system: { stations: [], derived: { traitFlags }, movedThisTurn },
    getActiveTokens: () => [],
    update: async data => { updates.push(data); },
    _updates: updates
  };
}

function fixedWeapon() {
  return {
    name: "Спонсонная пушка",
    system: {
      weaponClass: "heavy", damage: "1d10+4", penetration: 6, rof_single: 1, attackBonus: 0,
      vehicleMount: { mount: "fixed", hArc: "360°" }
    }
  };
}

function fireForm() {
  return fakeForm({
    "#vf-bs": "40", "#vf-atkbonus": "0", "#vf-mod": "0", "#vf-range": "0",
    "input[name='vf-rof']:checked": { value: "single", dataset: { bonus: "10" } },
    "#vf-aim": { value: "", selectedOptions: [{ dataset: { penalty: "0" } }] }
  });
}

beforeEach(() => {
  resetCaptured();
  _executeAttackRoll.mockClear();
  globalThis.game.user.targets = [];
});

describe("Продвинутые Системы Управления: заметка в диалоге", () => {
  it("без Черты — обычная заметка про Operate+10, без упоминания Хода", () => {
    const v = sheetLike(vehicle({}));
    v._showVehicleFireDialog(fixedWeapon());
    expect(captured.dialog.content).toContain("Operate +10");
    expect(captured.dialog.content).not.toContain("Продвинутые Системы Управления");
  });

  it("с Чертой, Ход ещё не засчитан — заметка «засчитается автоматически»", () => {
    const v = sheetLike(vehicle({ advancedControls: true }, false));
    v._showVehicleFireDialog(fixedWeapon());
    expect(captured.dialog.content).toContain("засчитывается заодно");
  });

  it("с Чертой, Ход уже засчитан — заметка «уже засчитан»", () => {
    const v = sheetLike(vehicle({ advancedControls: true }, true));
    v._showVehicleFireDialog(fixedWeapon());
    expect(captured.dialog.content).toContain("уже засчитан");
  });
});

describe("Продвинутые Системы Управления: отметка после выстрела", () => {
  it("Ход ещё не засчитан — после «Огонь!» ставится movedThisTurn=true", async () => {
    const actor = vehicle({ advancedControls: true }, false);
    const v = sheetLike(actor);
    v._showVehicleFireDialog(fixedWeapon());

    await captured.press("fire", fireForm());

    expect(actor._updates).toEqual([{ "system.movedThisTurn": true }]);
  });

  it("Ход уже засчитан — после «Огонь!» повторно НЕ обновляется", async () => {
    const actor = vehicle({ advancedControls: true }, true);
    const v = sheetLike(actor);
    v._showVehicleFireDialog(fixedWeapon());

    await captured.press("fire", fireForm());

    expect(actor._updates).toEqual([]);
  });

  it("без Черты — стрельба из Закреплённого не трогает movedThisTurn вовсе", async () => {
    const actor = vehicle({}, false);
    const v = sheetLike(actor);
    v._showVehicleFireDialog(fixedWeapon());

    await captured.press("fire", fireForm());

    expect(actor._updates).toEqual([]);
  });
});

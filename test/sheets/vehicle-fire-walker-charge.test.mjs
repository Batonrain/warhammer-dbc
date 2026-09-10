// test/sheets/vehicle-fire-walker-charge.test.mjs
//
// wdbc-6wzt, п.1 книжного правила Ходовой «Шагоход»: объявленный Натиск должен
// доехать до самого броска рукопашной атаки машины, иначе он остаётся словами.
// У персонажа это делает База «Натиск» (+20, стр. 13); у машины рукопашка идёт
// отдельным диалогом (_showVehicleFireDialog), который про Натиск не знал вовсе.

import "../support/foundry-stub.mjs";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { captured, resetCaptured, fakeForm } from "../support/foundry-stub.mjs";

const { _executeAttackRoll } = vi.hoisted(() => ({ _executeAttackRoll: vi.fn() }));
vi.mock("../../module/combat/attack.mjs", () => ({ _executeAttackRoll }));

import { WarhammerVehicleSheet } from "../../module/sheets/vehicle-sheet.mjs";
import { WALKER_CHARGE_FLAG } from "../../module/combat/walker.mjs";

function sheetLike(actor) {
  return Object.assign(Object.create(WarhammerVehicleSheet.prototype), { actor });
}

function walkerVehicle({ chassis = "walker", charge = null } = {}) {
  const flags = charge ? { [`warhammer-dbc.${WALKER_CHARGE_FLAG}`]: charge } : {};
  return {
    type: "vehicle", name: "«Ярость Терры»", uuid: "Actor.walker",
    system: { chassis: { type: chassis, spd: 6 }, stations: [], derived: { traitFlags: {} } },
    getFlag: (scope, key) => flags[`${scope}.${key}`],
    getActiveTokens: () => []
  };
}

function fistItem() {
  return {
    name: "Силовой Кулак",
    system: {
      weaponClass: "melee", damage: "2d10+8", penetration: 10, attackBonus: 0,
      vehicleMount: { mount: "hull", hArc: "180°" }
    }
  };
}

/** Поля окна рукопашной: BS оператора 40, режим «Рукопашная», без прицела. */
function meleeForm(bonus) {
  return fakeForm({
    "#vf-bs": "40", "#vf-atkbonus": "0", "#vf-mod": "0", "#vf-range": "0",
    "input[name='vf-rof']:checked": { value: "melee", dataset: { bonus: String(bonus) } },
    "#vf-aim": { value: "", selectedOptions: [{ dataset: { penalty: "0" } }] }
  });
}

beforeEach(() => {
  resetCaptured();
  _executeAttackRoll.mockClear();
  globalThis.game.user.targets = [];
  globalThis.game.combat = { started: true, round: 2, id: "c1" };
});
afterEach(() => { globalThis.game.combat = undefined; });

describe("рукопашная Шагохода и объявленный Натиск", () => {
  it("без Натиска — режим «Рукопашная (±0)», Порог без прибавки", async () => {
    sheetLike(walkerVehicle())._showVehicleFireDialog(fistItem());

    expect(captured.dialog.content).toContain("Рукопашная (±0)");
    expect(captured.dialog.content).not.toContain("Натиск (+20)");

    await captured.press("fire", meleeForm(0));
    expect(_executeAttackRoll).toHaveBeenCalledWith(
      expect.anything(), expect.anything(), "bs", 40, "melee", null, expect.anything());
  });

  it("Натиск объявлен в этом Раунде — режим несёт +20 и он входит в Порог", async () => {
    sheetLike(walkerVehicle({ charge: { combat: "c1", round: 2 } }))._showVehicleFireDialog(fistItem());

    expect(captured.dialog.content).toContain("Рукопашная — Натиск (+20)");
    expect(captured.dialog.content).toContain('data-bonus="20"');

    await captured.press("fire", meleeForm(20));
    expect(_executeAttackRoll).toHaveBeenCalledWith(
      expect.anything(), expect.anything(), "bs", 60, "melee", null, expect.anything());
  });

  it("Натиск прошлого Раунда бонуса не даёт", () => {
    sheetLike(walkerVehicle({ charge: { combat: "c1", round: 1 } }))._showVehicleFireDialog(fistItem());
    expect(captured.dialog.content).toContain("Рукопашная (±0)");
  });

  it("не Шагоход — метка Натиска ничего не значит (правила у шасси нет)", () => {
    sheetLike(walkerVehicle({ chassis: "tracked", charge: { combat: "c1", round: 2 } }))
      ._showVehicleFireDialog(fistItem());
    expect(captured.dialog.content).toContain("Рукопашная (±0)");
  });

  it("стрелковому орудию Натиск режимов не меняет", () => {
    const gun = fistItem();
    gun.system.weaponClass = "heavy";
    gun.system.rof_single = 1;
    sheetLike(walkerVehicle({ charge: { combat: "c1", round: 2 } }))._showVehicleFireDialog(gun);
    expect(captured.dialog.content).not.toContain("Натиск (+20)");
    expect(captured.dialog.content).toContain("Одиночный");
  });
});

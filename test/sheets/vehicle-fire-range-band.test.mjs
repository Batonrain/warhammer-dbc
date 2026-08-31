// test/sheets/vehicle-fire-range-band.test.mjs
//
// wdbc-5il7 (п.4): полоса дальности стрельбы техники отмечается сама по уже
// измеренной дистанции до цели (measureTokens + rangeBandKey — те же, что у
// личного диалога атаки, wdbc-mysg), а не ручным дропдауном. У техники
// дропдаун огрублён до 3 пунктов: pointBlank/short → «+10», long/extreme/out → «−10».

import "../support/foundry-stub.mjs";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { captured, resetCaptured, fakeForm } from "../support/foundry-stub.mjs";

const { _executeAttackRoll } = vi.hoisted(() => ({ _executeAttackRoll: vi.fn() }));
vi.mock("../../module/combat/attack.mjs", () => ({ _executeAttackRoll }));

import { WarhammerVehicleSheet } from "../../module/sheets/vehicle-sheet.mjs";

function sheetLike(actor) {
  return Object.assign(Object.create(WarhammerVehicleSheet.prototype), { actor });
}

function vehicleToken({ x = 0, y = 0, width = 2, height = 2 } = {}) {
  return { document: { x, y, width, height } };
}

function vehicle(vToken, traitFlags = {}) {
  return {
    name: "Хищник", uuid: "Actor.vehicle",
    system: { stations: [], derived: { traitFlags } },
    getActiveTokens: () => (vToken ? [vToken] : [])
  };
}

function weaponItem(range = 30) {
  return {
    name: "Автопушка",
    system: {
      weaponClass: "heavy", damage: "1d10+4", penetration: 6, range,
      rof_single: 1, attackBonus: 0,
      vehicleMount: { mount: "turret", hArc: "360°" }
    }
  };
}

function fireForm(extra = {}) {
  return fakeForm({
    "#vf-bs": "40", "#vf-atkbonus": "0", "#vf-mod": "0",
    "input[name='vf-rof']:checked": { value: "single", dataset: { bonus: "10" } },
    "#vf-aim": { value: "", selectedOptions: [{ dataset: { penalty: "0" } }] },
    ...extra
  });
}

beforeEach(() => {
  resetCaptured();
  _executeAttackRoll.mockClear();
  // grid.size 1 — doc.x/y читаются как метры напрямую (тот же приём, что
  // test/combat/tactical-map.test.mjs), без пересчёта клетка↔пиксель↔метр.
  globalThis.canvas = { grid: { size: 1 } };
  globalThis.game.user.targets = [];
});

describe("Полоса дальности техники: автоотметка по измеренной дистанции", () => {
  it("цель рядом (короткая/в упор) — автоотмечена «Ближе / Короткая (+10)»", () => {
    const vt = vehicleToken({ x: 0, y: 0 });
    const target = vehicleToken({ x: 4, y: 0 }); // edgeM мал относительно Rng 30
    globalThis.game.user.targets = [target];
    sheetLike(vehicle(vt))._showVehicleFireDialog(weaponItem(30));
    const html = captured.dialog.content;
    expect(html).toMatch(/value="10" selected/);
    expect(html).toContain("Измеренная дистанция");
  });

  it("цель в боевой дистанции — автоотмечена «В пределах дальности (0)»", () => {
    const vt = vehicleToken({ x: 0, y: 0 });
    const target = vehicleToken({ x: 25, y: 0 });
    globalThis.game.user.targets = [target];
    sheetLike(vehicle(vt))._showVehicleFireDialog(weaponItem(30));
    expect(captured.dialog.content).toMatch(/value="0" selected/);
  });

  it("цель далеко (дальняя) — автоотмечена «Дальняя (−10)»", () => {
    const vt = vehicleToken({ x: 0, y: 0 });
    const target = vehicleToken({ x: 50, y: 0 });
    globalThis.game.user.targets = [target];
    sheetLike(vehicle(vt))._showVehicleFireDialog(weaponItem(30));
    expect(captured.dialog.content).toMatch(/value="-10" selected/);
  });

  it("цель вне 3×Rng — «Дальняя» + видимое предупреждение", () => {
    const vt = vehicleToken({ x: 0, y: 0 });
    const target = vehicleToken({ x: 200, y: 0 });
    globalThis.game.user.targets = [target];
    sheetLike(vehicle(vt))._showVehicleFireDialog(weaponItem(30));
    const html = captured.dialog.content;
    expect(html).toMatch(/value="-10" selected/);
    expect(html).toContain("Цель вне дальности");
  });

  it("без цели — «В пределах дальности (0)» по умолчанию, как раньше", () => {
    const vt = vehicleToken({ x: 0, y: 0 });
    sheetLike(vehicle(vt))._showVehicleFireDialog(weaponItem(30));
    expect(captured.dialog.content).toMatch(/value="0" selected/);
    expect(captured.dialog.content).not.toContain("Измеренная дистанция");
  });

  it("автоотметка по-прежнему переключается руками — выбор из формы уходит в бросок", async () => {
    const vt = vehicleToken({ x: 0, y: 0 });
    const target = vehicleToken({ x: 50, y: 0 }); // авто «−10»
    globalThis.game.user.targets = [target];
    sheetLike(vehicle(vt))._showVehicleFireDialog(weaponItem(30));

    await captured.press("fire", fireForm({ "#vf-range": "10" })); // игрок переключил руками
    // 40 + 0 + 10(rof) + 0(aim) + 10(ручной выбор) + 0 = 60
    expect(_executeAttackRoll).toHaveBeenCalledWith(
      expect.anything(), expect.anything(), "bs", 60, "single", null, expect.anything());
  });
});

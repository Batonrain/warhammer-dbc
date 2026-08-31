// test/sheets/vehicle-fire-onslaught.test.mjs
//
// wdbc-y33b: Штурм (Onslaught) — во время Натиска стрельба всегда с Боевой
// дистанции (форсирует +10 «Ближе/Короткая» независимо от выбора в #vf-range).
// Мультиприцел/Продвинутые Прицельные/Продвинутые Системы Управления — только
// заметка в диалоге (действие-экономику стрельбы техники система не считает).

import "../support/foundry-stub.mjs";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { captured, resetCaptured, fakeForm } from "../support/foundry-stub.mjs";

const { _executeAttackRoll } = vi.hoisted(() => ({ _executeAttackRoll: vi.fn() }));
vi.mock("../../module/combat/attack.mjs", () => ({ _executeAttackRoll }));

import { WarhammerVehicleSheet } from "../../module/sheets/vehicle-sheet.mjs";

function sheetLike(actor) {
  return Object.assign(Object.create(WarhammerVehicleSheet.prototype), { actor });
}

function vehicle(traitFlags = {}) {
  return {
    name: "Хищник", uuid: "Actor.vehicle",
    system: { stations: [], derived: { traitFlags } },
    getActiveTokens: () => []
  };
}

function weaponItem() {
  return {
    name: "Автопушка",
    system: {
      weaponClass: "heavy", damage: "1d10+4", penetration: 6,
      rof_single: 1, attackBonus: 0,
      vehicleMount: { mount: "turret", hArc: "360°" }
    }
  };
}

/** Поля формы стрельбы: BS=40, режим "Одиночный (+10)", без прицела, дальняя (-10) — если Штурм её не форсирует. */
function fireForm(extra = {}) {
  return fakeForm({
    "#vf-bs": "40", "#vf-atkbonus": "0", "#vf-mod": "0",
    "#vf-range": "-10",
    "input[name='vf-rof']:checked": { value: "single", dataset: { bonus: "10" } },
    "#vf-aim": { value: "", selectedOptions: [{ dataset: { penalty: "0" } }] },
    ...extra
  });
}

beforeEach(() => {
  resetCaptured();
  _executeAttackRoll.mockClear();
  globalThis.game.user.targets = [];
});

describe("Штурм: Боевая дистанция", () => {
  it("без Черты — галочка не показывается, диалог использует выбранную дальность", async () => {
    sheetLike(vehicle({}))._showVehicleFireDialog(weaponItem());
    expect(captured.dialog.content).not.toContain("vf-onslaught");

    await captured.press("fire", fireForm());
    // 40 + 0(atkBonus) + 10(rof) + 0(aim) + (-10 дальняя) + 0(mod) = 40
    expect(_executeAttackRoll).toHaveBeenCalledWith(
      expect.anything(), expect.anything(), "bs", 40, "single", null, expect.anything());
  });

  it("с Чертой, галочка не отмечена — дальность как выбрано (без изменений)", async () => {
    sheetLike(vehicle({ onslaught: true }))._showVehicleFireDialog(weaponItem());
    expect(captured.dialog.content).toContain("vf-onslaught");

    await captured.press("fire", fireForm());
    expect(_executeAttackRoll).toHaveBeenCalledWith(
      expect.anything(), expect.anything(), "bs", 40, "single", null, expect.anything());
  });

  it("с Чертой, галочка отмечена — дальность форсируется на Боевую (+10), выбор в #vf-range игнорируется", async () => {
    sheetLike(vehicle({ onslaught: true }))._showVehicleFireDialog(weaponItem());

    await captured.press("fire", fireForm({ "#vf-onslaught": true }));
    // 40 + 0 + 10(rof) + 0(aim) + 10(Штурм, вместо −10 из #vf-range) + 0 = 60
    expect(_executeAttackRoll).toHaveBeenCalledWith(
      expect.anything(), expect.anything(), "bs", 60, "single", null, expect.anything());
  });

  it("рукопашное оружие — галочка Штурма не показывается вовсе", async () => {
    const melee = weaponItem();
    melee.system.weaponClass = "melee";
    sheetLike(vehicle({ onslaught: true }))._showVehicleFireDialog(melee);
    expect(captured.dialog.content).not.toContain("vf-onslaught");
  });
});

describe("Мультиприцел / Продвинутые Прицельные / Продвинутые Системы Управления — заметки", () => {
  it("без Черт — заметок нет", () => {
    sheetLike(vehicle({}))._showVehicleFireDialog(weaponItem());
    expect(captured.dialog.content).not.toContain("Мультиприцел");
    expect(captured.dialog.content).not.toContain("Продвинутые");
  });

  it("все три сразу — каждая своя строка", () => {
    sheetLike(vehicle({ multiTargeter: true, advancedTargeting: true, advancedControls: true }))
      ._showVehicleFireDialog(weaponItem());
    const html = captured.dialog.content;
    expect(html).toContain("Мультиприцел");
    expect(html).toContain("Продвинутые Прицельные Системы");
    expect(html).toContain("Продвинутые Системы Управления");
  });
});

// test/combat/vehicle-terrain-ceramite.test.mjs
//
// Две Черты техники, дочитанные в wdbc-m38e:
//  — Амфибия (module/combat/vehicle.mjs::showTerrainDialog) — по воде не
//    считается Трудным Ландшафтом, галочка обнуляет тест целиком;
//  — Керамитовая Броня (module/combat/vehicle.mjs::applyDamageToVehicle) —
//    АР удваивается против урона со свойством Flame (иммунитет к Melta не
//    автоматизирован — см. комментарий у ceramitePlating в constants/
//    vehicle-traits.mjs).

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured, fakeHtml } from "../support/foundry-stub.mjs";
import { showTerrainDialog, applyDamageToVehicle } from "../../module/combat/vehicle.mjs";

function vehicle(traitFlags = {}, overrides = {}) {
  const updates = [];
  return {
    type: "vehicle",
    name: "Salamander",
    system: {
      operate: 40,
      armour: { side: 10 },
      structure: { value: 20, critical: 0 },
      derived: { traitFlags },
      ...overrides
    },
    getActiveTokens: () => [],
    update: async data => { updates.push(data); },
    _updates: updates
  };
}

beforeEach(() => {
  resetCaptured();
  captured.dice = [50];
});

describe("Амфибия: Трудный Ландшафт по воде", () => {
  it("без Черты — галочка не показывается в диалоге", async () => {
    const actor = vehicle({});
    await showTerrainDialog(actor);
    expect(captured.dialog.content).not.toContain("tr-amph");
  });

  it("с Чертой, галочка не отмечена — тест идёт как обычно", async () => {
    const actor = vehicle({ amphibious: true });
    await showTerrainDialog(actor);
    expect(captured.dialog.content).toContain("tr-amph");

    await captured.dialog.buttons.roll.callback(
      fakeHtml({ "#tr-op": "40", "#tr-terrain": "-15", "#tr-man": "0", "#tr-mod": "0" }));

    const card = captured.chat.at(-1).content;
    expect(card).not.toContain("Амфибия");
  });

  it("с Чертой, галочка отмечена — тест не требуется вовсе", async () => {
    const actor = vehicle({ amphibious: true });
    await showTerrainDialog(actor);

    await captured.dialog.buttons.roll.callback(
      fakeHtml({ "#tr-op": "40", "#tr-terrain": "-15", "#tr-man": "0", "#tr-mod": "0", "#tr-amph": true }));

    const card = captured.chat.at(-1).content;
    expect(card).toContain("Амфибия");
    expect(card).toContain("тест не требуется");
    expect(captured.dice.length).toBe(1); // бросок кубика не потрачен
  });
});

describe("Керамитовая Броня: АР ×2 против Flame", () => {
  it.each([
    ["без Черты — Flame не меняет АР", {}, { flame: true }, "AP Бортовая: <b>10</b>"],
    ["с Чертой, попадание без Flame — АР не меняется", { ceramitePlating: true }, { flame: false }, "AP Бортовая: <b>10</b>"],
    // 15 урона − 20 АР = поглощено полностью
    ["с Чертой, попадание Flame — АР удваивается, урон поглощён", { ceramitePlating: true }, { flame: true }, "AP Бортовая: <b>20</b>", "Урон поглощён"]
  ])("%s", async (_title, traits, dmgOverrides, apExpected, extraExpected) => {
    const actor = vehicle(traits);
    await applyDamageToVehicle(actor, { rawDamage: 15, side: "side", ...dmgOverrides });
    const card = captured.chat.at(-1).content;
    expect(card).toContain(apExpected);
    if (extraExpected) expect(card).toContain(extraExpected);
  });
});

describe("Демонический (X): +X к поглощению, обнуляется против Sanctified/Warp Weapon", () => {
  it.each([
    ["без Черты — АР как есть", {}, {}, "AP Бортовая: <b>10</b>"],
    ["с Чертой — АР увеличивается на X", { daemonicAbsorb: 6 }, {}, "AP Бортовая: <b>16</b>"],
    ["Sanctified — бонус не действует", { daemonicAbsorb: 6 }, { sanctified: true }, "AP Бортовая: <b>10</b>"],
    ["Warp Weapon (warpSoak) — бонус не действует", { daemonicAbsorb: 6 }, { warpSoak: true }, "AP Бортовая: <b>10</b>"],
    // (10×2) + 6
    ["складывается с Керамитовой Бронёй (Flame)", { daemonicAbsorb: 6, ceramitePlating: true }, { flame: true }, "AP Бортовая: <b>26</b>"]
  ])("%s", async (_title, traits, dmgOverrides, expected) => {
    const actor = vehicle(traits);
    await applyDamageToVehicle(actor, { rawDamage: 15, side: "side", ...dmgOverrides });
    expect(captured.chat.at(-1).content).toContain(expected);
  });
});

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { openGearPicker } from "../../module/sheets/gear-picker.mjs";

const actor = {
  createEmbeddedDocuments: async () => []
};

beforeEach(() => {
  resetCaptured();
  game.packs = new Map();
  globalThis.window = { innerWidth: 1200, innerHeight: 900 };
});

describe("openGearPicker", () => {
  it("строит вкладки и краткую строку оружия из компендиума", async () => {
    game.packs.set("warhammer-dbc.weapons", {
      getDocuments: async () => [{
        id: "w1",
        uuid: "Compendium.warhammer-dbc.weapons.w1",
        name: "Boltgun / Болтер",
        type: "weapon",
        folder: { name: "Стрелковое" },
        system: {
          damage: "1d10+5",
          damageType: "blast",
          penetration: 4,
          range: 100,
          rof_single: 1,
          rof_semi: 3,
          weight: 7,
          availability: -10,
          special: "Стандартное болтерное оружие."
        }
      }]
    });

    await openGearPicker(actor);

    expect(captured.dialog.title).toContain("Библиотека снаряжения");
    expect(captured.dialog.content).toContain("Оружие");
    expect(captured.dialog.content).toContain("Boltgun / Болтер");
    expect(captured.dialog.content).toContain("1d10+5 Взрывной");
    expect(captured.dialog.content).toContain("Проб. 4");
    expect(captured.dialog.content).toContain("RoF 1/3/–");
  });
});

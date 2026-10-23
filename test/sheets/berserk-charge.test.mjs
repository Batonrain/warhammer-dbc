// test/sheets/berserk-charge.test.mjs
//
// Натиск Берсерка (Sahara 3-861e, корбук pdf-стр. 62): «+10 на рукопашные приемы
// при Натиске» — во всех местах, где считается бонус Базы: окно атаки оружием
// (База выбирается прямо в окне — sheets/attack/selection.mjs), приём без оружия,
// «Замахнуться» предметом, колонка «Порог» на листе, «Замахнуться» партнёром.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { actorFor, weaponFor } from "../support/combat-fixtures.mjs";
import { showAttackDialog, showAttackDialogNoWeapon } from "../../module/sheets/attack-dialog.mjs";
import { useSwingItem } from "../../module/combat/improvised-item.mjs";

const talent = name => ({ id: "t1", type: "talent", name, system: {}, flags: {}, getFlag: () => undefined });
const BERSERK = "Berserk Charge / Натиск Берсерка";

function fighter({ items = [], meleeBase = "standard" } = {}) {
  const a = actorFor({ items, fatigue: { value: 0 }, aiming: "none", meleeBase });
  a.type = "character"; a.uuid = "Actor.fighter";
  a.update = async () => {};
  a.getFlag = () => undefined;
  return a;
}

const dialogThreshold = () => {
  const m = (captured.dialog?.content ?? "").match(/id="atk-total-display">(-?\d+)</);
  return m ? Number(m[1]) : null;
};

beforeEach(() => {
  resetCaptured();
  globalThis.game.time = { worldTime: 0 };
  globalThis.game.user = { targets: [] };
  globalThis.game.combat = undefined;
});

describe("окно атаки оружием", () => {
  const open = (meleeBase, withTalent) => {
    const sword = weaponFor({ weaponClass: "melee" });
    showAttackDialog(fighter({ items: [sword, ...(withTalent ? [talent(BERSERK)] : [])], meleeBase }), sword);
  };

  it("Натиск без Таланта: WS 45 + 20 = 65 (контроль)", () => {
    open("charge", false);
    expect(dialogThreshold()).toBe(65);
    expect(captured.dialog.content).toContain("Натиск (+20)");
  });

  it("Натиск с Талантом: 75, бейдж называет и Базу, и Талант", () => {
    open("charge", true);
    expect(dialogThreshold()).toBe(75);
    expect(captured.dialog.content).toContain("Натиск Берсерка");
    expect(captured.dialog.content).toContain("(+30)");
  });

  it("Стандартная и Полная Атака Талант не усиливает", () => {
    open("standard", true);
    expect(dialogThreshold()).toBe(55);
    resetCaptured();
    open("fullatk", true);
    expect(dialogThreshold()).toBe(75);          // WS 45 + 30 Полной Атаки, без добавки Талантом
  });
});

describe("приём без оружия", () => {
  const kick = { label: "Пинок", wsBonus: -10, damage: "1d5-1+S.b", damageType: "impact", pen: 0 };

  it.each([[false, 65], [true, 75]])("Натиск, Талант=%s → порог %i", async (withTalent, expected) => {
    captured.dice = [30, 4];
    await showAttackDialogNoWeapon(fighter({ items: withTalent ? [talent(BERSERK)] : [], meleeBase: "charge" }), kick);
    // WS 45 + База Натиска (+20 / +30) − 10 приём.
    expect(captured.chat.at(-1).content).toContain(`<label>Порог</label><b>${expected - 10}</b>`);
  });
});

describe("«Замахнуться» предметом", () => {
  function swing(withTalent) {
    const a = fighter({ items: withTalent ? [talent(BERSERK)] : [], meleeBase: "charge" });
    a.system.characteristics.ws = { total: 40 };
    a.system.encumbrance = { carry: 100 };
    globalThis.game.user.targets = [{ actor: { id: "t", name: "Орк", uuid: "Actor.t" } }];
    return useSwingItem(a, { id: "i", name: "Труба", system: { weight: 10 } });
  }

  it("Натиск: база +20, с Талантом +30", async () => {
    await swing(false);
    expect(captured.chat.at(-1).content).toContain("база +20");
    resetCaptured();
    globalThis.game.user = { targets: [] };
    await swing(true);
    expect(captured.chat.at(-1).content).toContain("база +30");
  });
});

describe("остальные места, где считается бонус Базы", () => {
  it("колонка «Порог» на листе и «Замахнуться» партнёром берут число из общей функции", () => {
    for (const file of ["module/sheets/sheet-helpers.mjs", "module/combat/grapple.mjs"]) {
      const src = readFileSync(file, "utf8");
      expect(src, file).toContain("meleeBaseBonus(");
      expect(src, file).not.toMatch(/MELEE_BASES\[[^\]]*\]\?\.wsBonus/);
    }
  });
});

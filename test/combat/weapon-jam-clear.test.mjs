// test/combat/weapon-jam-clear.test.mjs
//
// module/combat/weapon-properties.mjs::canClearJam (wdbc-vwfk) — блокировка
// на 1 Раунд от Reformation Song/Разрушение (jamLockedRound), не тронута.
//
// module/combat/clear-jam.mjs::rollClearJam (стр. 35, wdbc-x1nz.2.52) —
// «Расклин»: Полное действие (2 ОД), тест Tech-Use+0 или Trade(Weaponsmith)+0
// (автовыбор лучшего), Успех снимает Клин. Раньше клин снимался мгновенно и
// без броска — историю решения см. в git у clearWeaponJam.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";

import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { canClearJam } from "../../module/combat/weapon-properties.mjs";
import { rollClearJam, clearJamOption } from "../../module/combat/clear-jam.mjs";

function weapon({ jammed = true, jamLockedRound = 0, name = "Тест-оружие" } = {}) {
  const item = {
    name,
    system: { jammed, jamLockedRound },
    update: async patch => {
      for (const [path, value] of Object.entries(patch)) item.system[path.replace(/^system\./, "")] = value;
    }
  };
  return item;
}

function actor({ ap = 2, techUseTotal = 30, weaponsmithTotal = null } = {}) {
  const a = {
    name: "Техножрец", type: "character",
    system: {
      actionPoints: { value: ap, max: 2 },
      characteristics: { int: { total: 40 } },
      skills: { techUse: { total: techUseTotal } },
      groupSkills: { trade: weaponsmithTotal != null
        ? [{ specialty: "Weaponsmith", total: weaponsmithTotal }] : [] }
    },
    update: async data => {
      for (const [path, value] of Object.entries(data)) {
        const keys = path.split(".");
        let node = a;
        for (const k of keys.slice(0, -1)) node = (node[k] ??= {});
        node[keys.at(-1)] = value;
      }
    }
  };
  return a;
}

beforeEach(() => { resetCaptured(); globalThis.game.combat = { started: true }; });
afterEach(() => { resetCaptured(); globalThis.game.combat = undefined; });

describe("canClearJam", () => {
  it("не заблокировано, если jamLockedRound=0", () => {
    expect(canClearJam(weapon({ jamLockedRound: 0 }))).toBe(true);
  });
  it("не заблокировано вне боя, даже если jamLockedRound стоит", () => {
    globalThis.game.combat = undefined;
    expect(canClearJam(weapon({ jamLockedRound: 5 }))).toBe(true);
  });
  it("заблокировано в бою, пока текущий Раунд ≤ jamLockedRound", () => {
    globalThis.game.combat = { round: 3 };
    expect(canClearJam(weapon({ jamLockedRound: 3 }))).toBe(false);
  });
  it("снова доступно, как только Раунд превысил jamLockedRound", () => {
    globalThis.game.combat = { round: 4 };
    expect(canClearJam(weapon({ jamLockedRound: 3 }))).toBe(true);
  });
});

describe("clearJamOption: автовыбор лучшего из Tech-Use/Trade(Weaponsmith)", () => {
  it("нет Trade(Weaponsmith) — берёт Tech-Use", () => {
    expect(clearJamOption(actor({ techUseTotal: 35 }))).toMatchObject({ skillKey: "techUse", base: 35 });
  });
  it("Trade(Weaponsmith) выше Tech-Use — берёт его", () => {
    expect(clearJamOption(actor({ techUseTotal: 20, weaponsmithTotal: 50 })))
      .toMatchObject({ skillKey: "trade", base: 50, label: "Trade (Weaponsmith)" });
  });
  it("Tech-Use выше Trade(Weaponsmith) — берёт Tech-Use", () => {
    expect(clearJamOption(actor({ techUseTotal: 60, weaponsmithTotal: 20 })))
      .toMatchObject({ skillKey: "techUse", base: 60 });
  });
});

describe("rollClearJam", () => {
  it("Успех — снимает jammed, сбрасывает jamLockedRound, тратит 2 ОД", async () => {
    const a = actor({ ap: 2, techUseTotal: 40 });
    const w = weapon({ jammed: true, jamLockedRound: 0 });
    captured.dice = [10]; // rv=10 <= Порог 40 — успех
    await rollClearJam(a, w);
    expect(w.system.jammed).toBe(false);
    expect(w.system.jamLockedRound).toBe(0);
    expect(a.system.actionPoints.value).toBe(0);
    expect(captured.chat.at(-1).content).toContain("Клин снят");
  });

  it("Провал — оружие остаётся заклинено, но ОД всё равно потрачены", async () => {
    const a = actor({ ap: 2, techUseTotal: 20 });
    const w = weapon({ jammed: true, jamLockedRound: 0 });
    captured.dice = [90]; // rv=90 > Порог 20 — провал
    await rollClearJam(a, w);
    expect(w.system.jammed).toBe(true);
    expect(a.system.actionPoints.value).toBe(0);
    expect(captured.chat.at(-1).content).toContain("Провал");
  });

  it("не хватает ОД — предупреждение, бросок не делается", async () => {
    const a = actor({ ap: 1 });
    const w = weapon({ jammed: true });
    await rollClearJam(a, w);
    expect(w.system.jammed).toBe(true);
    expect(captured.warnings.length).toBeGreaterThan(0);
    expect(captured.chat).toHaveLength(0);
  });

  it("заблокировано Reformation Song — предупреждение, ОД не тратятся", async () => {
    globalThis.game.combat = { round: 2 };
    const a = actor({ ap: 2 });
    const w = weapon({ jammed: true, jamLockedRound: 2 });
    await rollClearJam(a, w);
    expect(a.system.actionPoints.value).toBe(2);
    expect(captured.warnings.length).toBeGreaterThan(0);
  });

  it("не трогает не заклинившее оружие", async () => {
    const a = actor();
    const w = weapon({ jammed: false });
    await rollClearJam(a, w);
    expect(w.system.jammed).toBe(false);
    expect(captured.chat).toHaveLength(0);
  });
});

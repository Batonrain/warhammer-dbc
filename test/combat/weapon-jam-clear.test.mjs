// test/combat/weapon-jam-clear.test.mjs
//
// module/combat/weapon-properties.mjs::canClearJam/clearWeaponJam (wdbc-vwfk)
// — «Расклинить», доступно всегда (тот же приём, что damage.mjs::
// repairArmorCorrosion), кроме блокировки на 1 Раунд от Reformation Song/
// Разрушение (jamLockedRound).

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";

import { describe, it, expect, afterEach } from "vitest";
import { canClearJam, clearWeaponJam } from "../../module/combat/weapon-properties.mjs";

function weapon({ jammed = true, jamLockedRound = 0 } = {}) {
  const item = {
    name: "Тест-оружие",
    system: { jammed, jamLockedRound },
    update: async patch => {
      for (const [path, value] of Object.entries(patch)) item.system[path.replace(/^system\./, "")] = value;
    }
  };
  return item;
}

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

describe("clearWeaponJam", () => {
  it("снимает jammed и сбрасывает jamLockedRound, когда можно", async () => {
    const w = weapon({ jammed: true, jamLockedRound: 0 });
    await clearWeaponJam(w);
    expect(w.system.jammed).toBe(false);
    expect(w.system.jamLockedRound).toBe(0);
  });

  it("ничего не делает и предупреждает, если заблокировано Reformation Song", async () => {
    globalThis.game.combat = { round: 2 };
    const w = weapon({ jammed: true, jamLockedRound: 2 });
    await clearWeaponJam(w);
    expect(w.system.jammed).toBe(true);
    expect(captured.warnings.length).toBeGreaterThan(0);
  });

  it("не трогает не заклинившее оружие", async () => {
    const w = weapon({ jammed: false });
    await clearWeaponJam(w);
    expect(w.system.jammed).toBe(false);
  });
});

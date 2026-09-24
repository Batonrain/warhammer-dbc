import { describe, it, expect, afterEach } from "vitest";
import "../support/foundry-stub.mjs";
import { killByCondition } from "../../module/combat/condition-death.mjs";

// Смерть от Состояния (wdbc-x1nz.2.92/.94/.96): флаг deceased + «Повержен» на
// токене + defeated в трекере — один путь для Кровотечения, Удушья, Гангрены.

function actor({ deceased = false } = {}) {
  const flags = { deceased };
  const a = {
    id: "a1", name: "Жертва",
    flags, statuses: [],
    getFlag: (_s, k) => flags[k],
    setFlag: async (_s, k, v) => { flags[k] = v; return v; },
    toggleStatusEffect: async (id, opts) => { a.statuses.push({ id, ...opts }); }
  };
  return a;
}

const savedCombat = globalThis.game?.combat;
const savedSpecial = globalThis.CONFIG?.specialStatusEffects;
afterEach(() => {
  globalThis.game.combat = savedCombat;
  globalThis.CONFIG.specialStatusEffects = savedSpecial;
});

describe("killByCondition", () => {
  it("ставит флаг смерти, статус «Повержен» и defeated у участника боя", async () => {
    const a = actor();
    const updates = [];
    const combatant = { actor: a, defeated: false, update: async d => { updates.push(d); } };
    globalThis.CONFIG.specialStatusEffects = { ...(savedSpecial ?? {}), DEFEATED: "dead" };
    globalThis.game.combat = { combatants: [combatant] };

    expect(await killByCondition(a)).toBe(true);
    expect(a.flags.deceased).toBe(true);
    expect(a.statuses).toEqual([{ id: "dead", active: true, overlay: true }]);
    expect(updates).toEqual([{ defeated: true }]);
  });

  it("уже мёртвого повторно не убивает", async () => {
    const a = actor({ deceased: true });
    globalThis.CONFIG.specialStatusEffects = { DEFEATED: "dead" };
    expect(await killByCondition(a)).toBe(false);
    expect(a.statuses).toEqual([]);
  });

  it("без актора — ничего", async () => {
    expect(await killByCondition(null)).toBe(false);
  });
});

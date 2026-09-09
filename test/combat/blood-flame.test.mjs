// test/combat/blood-flame.test.mjs
//
// Кровавое Пламя — боевой такт: убийство этим оружием (растёт бонус) и конец
// боя/сцены (оружие ломается). Активация — test/apps/blood-flame.test.mjs.

import { describe, it, expect } from "vitest";
import { registerBloodFlameKill, clearBloodFlameBuffs } from "../../module/combat/blood-flame.mjs";
import { ACTIVE_FLAG, KILLS_FLAG, ADDED_PROPS_FLAG } from "../../module/rules/blood-flame.mjs";

const NS = "warhammer-dbc";

function makeWeapon(overrides = {}) {
  const flagStore = { ...(overrides.flags || {}) };
  const weapon = {
    id: "weapon-1", type: "weapon", name: "Цепной топор",
    system: { weaponProps: overrides.weaponProps ?? [], destroyed: false },
    getFlag: (ns, key) => (ns === NS ? flagStore[key] : undefined),
    setFlag: async (ns, key, value) => { if (ns === NS) flagStore[key] = value; return weapon; },
    unsetFlag: async (ns, key) => { if (ns === NS) delete flagStore[key]; return weapon; },
    update: async data => {
      for (const [path, value] of Object.entries(data)) {
        if (path.startsWith(`flags.${NS}.-=`)) { delete flagStore[path.slice(`flags.${NS}.-=`.length)]; continue; }
        if (path.startsWith(`flags.${NS}.`)) { flagStore[path.slice(`flags.${NS}.`.length)] = value; continue; }
        const parts = path.split(".");
        let target = weapon;
        for (const p of parts.slice(0, -1)) target = (target[p] ??= {});
        target[parts.at(-1)] = value;
      }
      return weapon;
    }
  };
  return weapon;
}

describe("registerBloodFlameKill", () => {
  it("Пламя не горит на оружии — молча ничего не делает", async () => {
    const weapon = makeWeapon();
    await registerBloodFlameKill(weapon);
    expect(weapon.getFlag(NS, KILLS_FLAG)).toBeUndefined();
  });

  it("Пламя горит — первое убийство: 0 → 1", async () => {
    const weapon = makeWeapon({ flags: { [ACTIVE_FLAG]: true, [KILLS_FLAG]: 0 } });
    await registerBloodFlameKill(weapon);
    expect(weapon.getFlag(NS, KILLS_FLAG)).toBe(1);
  });

  it("второе убийство подряд — 1 → 2, не сбрасывается", async () => {
    const weapon = makeWeapon({ flags: { [ACTIVE_FLAG]: true, [KILLS_FLAG]: 1 } });
    await registerBloodFlameKill(weapon);
    expect(weapon.getFlag(NS, KILLS_FLAG)).toBe(2);
  });

  it("обычное оружие (без Кровавого Пламени вовсе) не ловит чужой kills", async () => {
    const weapon = makeWeapon();
    await registerBloodFlameKill(weapon);
    await registerBloodFlameKill(weapon);
    expect(weapon.getFlag(NS, KILLS_FLAG)).toBeUndefined();
  });
});

describe("clearBloodFlameBuffs — конец боя/сцены", () => {
  it("горящее оружие: снимает добавленные свойства, ставит destroyed, чистит флаги", async () => {
    const weapon = makeWeapon({
      weaponProps: [{ key: "powerField" }, { key: "flame" }, { key: "reinforced" }],
      flags: { [ACTIVE_FLAG]: true, [KILLS_FLAG]: 2, [ADDED_PROPS_FLAG]: ["powerField", "flame"] }
    });
    const combat = { combatants: [{ actor: { items: [weapon] } }] };
    await clearBloodFlameBuffs(combat);

    expect(weapon.system.destroyed).toBe(true);
    expect(weapon.system.weaponProps).toEqual([{ key: "reinforced" }]); // reinforced не наше — остаётся
    expect(weapon.getFlag(NS, ACTIVE_FLAG)).toBeUndefined();
    expect(weapon.getFlag(NS, KILLS_FLAG)).toBeUndefined();
    expect(weapon.getFlag(NS, ADDED_PROPS_FLAG)).toBeUndefined();
  });

  it("оружие уже несло Flame ДО активации (не наше) — своё не трогает при уборке", async () => {
    // addedKeys не включает "flame" (было и до активации) — только powerField.
    const weapon = makeWeapon({
      weaponProps: [{ key: "flame" }, { key: "powerField" }],
      flags: { [ACTIVE_FLAG]: true, [KILLS_FLAG]: 0, [ADDED_PROPS_FLAG]: ["powerField"] }
    });
    const combat = { combatants: [{ actor: { items: [weapon] } }] };
    await clearBloodFlameBuffs(combat);
    expect(weapon.system.weaponProps).toEqual([{ key: "flame" }]);
    expect(weapon.system.destroyed).toBe(true);
  });

  it("не горящее оружие рядом — не трогается вовсе", async () => {
    const burning = makeWeapon({ flags: { [ACTIVE_FLAG]: true, [KILLS_FLAG]: 0, [ADDED_PROPS_FLAG]: [] } });
    const cold = makeWeapon({ id: "weapon-2" });
    const combat = { combatants: [{ actor: { items: [burning, cold] } }] };
    await clearBloodFlameBuffs(combat);
    expect(burning.system.destroyed).toBe(true);
    expect(cold.system.destroyed).toBe(false);
  });

  it("пустой/битый combat — не падает", async () => {
    await expect(clearBloodFlameBuffs(null)).resolves.toBeUndefined();
    await expect(clearBloodFlameBuffs({ combatants: [{ actor: null }] })).resolves.toBeUndefined();
  });
});

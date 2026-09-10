// test/combat/blood-flame.test.mjs
//
// Кровавое Пламя — боевой такт: убийство этим оружием (растёт бонус) и конец
// боя/сцены (оружие ломается). Активация — test/apps/blood-flame.test.mjs.

import { describe, it, expect } from "vitest";
import { registerBloodFlameKill, clearBloodFlameBuffs, breakBloodFlameOnSceneEnd, cleanupBloodFlame }
  from "../../module/combat/blood-flame.mjs";
import { ACTIVE_FLAG, KILLS_FLAG, ADDED_PROPS_FLAG, SOURCE_FLAG } from "../../module/rules/blood-flame.mjs";

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

// ── wdbc-t4m: три дыры одного Дара ────────────────────────────────────────

function makeActor(items) {
  const list = [...items];
  list.get = id => list.find(i => i.id === id) ?? null;
  return { name: "Чемпион", items: list };
}

describe("breakBloodFlameOnSceneEnd — книжное «или сцены»", () => {
  it("конец сцены ломает горящее оружие у всех акторов мира", async () => {
    const burning = makeWeapon({
      flags: { [ACTIVE_FLAG]: true, [KILLS_FLAG]: 3, [ADDED_PROPS_FLAG]: ["powerField", "flame"] },
      weaponProps: [{ key: "powerField" }, { key: "flame" }, { key: "balanced" }]
    });
    globalThis.game = { actors: [makeActor([burning])] };

    await breakBloodFlameOnSceneEnd();

    expect(burning.system.destroyed).toBe(true);
    expect(burning.system.weaponProps).toEqual([{ key: "balanced" }]);
    expect(burning.getFlag(NS, ACTIVE_FLAG)).toBeUndefined();
    expect(burning.getFlag(NS, KILLS_FLAG)).toBeUndefined();
  });

  it("оружие без Пламени конец сцены не трогает", async () => {
    const plain = makeWeapon({ weaponProps: [{ key: "balanced" }] });
    globalThis.game = { actors: [makeActor([plain])] };
    await breakBloodFlameOnSceneEnd();
    expect(plain.system.destroyed).toBe(false);
    expect(plain.system.weaponProps).toEqual([{ key: "balanced" }]);
  });
});

describe("cleanupBloodFlame — сняли сам Дар", () => {
  it("Пламя гаснет, свойства снимаются, но оружие НЕ ломается", async () => {
    const burning = makeWeapon({
      flags: { [ACTIVE_FLAG]: true, [KILLS_FLAG]: 2,
               [ADDED_PROPS_FLAG]: ["powerField", "flame"], [SOURCE_FLAG]: "gift-1" },
      weaponProps: [{ key: "powerField" }, { key: "flame" }]
    });
    const actor = makeActor([burning]);   // сам Дар уже удалён Foundry

    await cleanupBloodFlame(actor, "gift-1");

    expect(burning.getFlag(NS, ACTIVE_FLAG)).toBeUndefined();
    expect(burning.system.weaponProps).toEqual([]);
    // Поломка — цена за проведённый бой, а не за снятие Дара.
    expect(burning.system.destroyed).toBe(false);
  });

  it("зажжено ДРУГИМ Даром — не трогается", async () => {
    const burning = makeWeapon({
      flags: { [ACTIVE_FLAG]: true, [ADDED_PROPS_FLAG]: ["flame"], [SOURCE_FLAG]: "gift-2" },
      weaponProps: [{ key: "flame" }]
    });
    await cleanupBloodFlame(makeActor([burning]), "gift-1");
    expect(burning.getFlag(NS, ACTIVE_FLAG)).toBe(true);
  });

  it("предмет с таким id ещё на акторе (удалили не его) — не трогается", async () => {
    const burning = makeWeapon({
      flags: { [ACTIVE_FLAG]: true, [ADDED_PROPS_FLAG]: [], [SOURCE_FLAG]: "gift-1" }
    });
    const gift = { id: "gift-1", type: "mutation", name: "Кровавое Пламя" };
    await cleanupBloodFlame(makeActor([burning, gift]), "gift-1");
    expect(burning.getFlag(NS, ACTIVE_FLAG)).toBe(true);
  });
});

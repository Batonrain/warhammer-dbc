// test/combat/wrapped-in-chaos.test.mjs
import "../support/foundry-stub.mjs";
import { describe, it, expect } from "vitest";
import { clearTaintedBladeBuffs } from "../../module/combat/wrapped-in-chaos.mjs";
import { TAINTED_BLADE_ADDED_FLAG } from "../../module/rules/wrapped-in-chaos.mjs";

function weaponWith(props, addedFlag) {
  const flags = addedFlag ? { "warhammer-dbc": { [TAINTED_BLADE_ADDED_FLAG]: true } } : {};
  const weapon = {
    id: "w1", type: "weapon", system: { weaponProps: props.map(p => ({ ...p })) },
    getFlag: (ns, k) => flags[ns]?.[k],
    update: async data => {
      if (data["system.weaponProps"]) weapon.system.weaponProps = data["system.weaponProps"];
      for (const k of Object.keys(data)) {
        if (k.startsWith("flags.warhammer-dbc.-=")) delete flags["warhammer-dbc"][k.split("-=")[1]];
      }
    }
  };
  return weapon;
}

describe("clearTaintedBladeBuffs", () => {
  it("снимает Tainted, добавленный этой находкой, не трогает флаг/свойство без метки", async () => {
    const added = weaponWith([{ key: "blast", rating: 2 }, { key: "tainted" }], true);
    const untouched = weaponWith([{ key: "tainted" }], false); // Tainted был у оружия и без находки
    const combat = { combatants: [{ actor: { items: [added, untouched] } }] };

    await clearTaintedBladeBuffs(combat);

    expect(added.system.weaponProps.map(p => p.key)).toEqual(["blast"]);
    expect(untouched.system.weaponProps.map(p => p.key)).toEqual(["tainted"]);
  });

  it("нет боя/бойцов — не падает", async () => {
    await expect(clearTaintedBladeBuffs(null)).resolves.toBeUndefined();
    await expect(clearTaintedBladeBuffs({ combatants: [] })).resolves.toBeUndefined();
  });
});

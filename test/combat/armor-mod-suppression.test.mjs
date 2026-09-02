// test/combat/armor-mod-suppression.test.mjs
//
// module/combat/armor-mods.mjs::getInstalledArmorMods — глушение чужих
// модов брони, пока стоит флаг reformationSongSuppressMods (wdbc-vwfk,
// Reformation Song/Разрушение: «доп. AP от других модов/талантов на эту
// броню до конца боя нивелируются»). Собственные моды Reformation Song
// (флаг reformationSongMod) не глушатся.

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { getInstalledArmorMods } from "../../module/combat/armor-mods.mjs";

function actorWith(...items) {
  const list = [...items];
  list.get = id => list.find(i => i.id === id) ?? null;
  return { items: list, system: {} };
}

const armor = (id, suppressed = false) => {
  const flags = suppressed ? { "warhammer-dbc.reformationSongSuppressMods": true } : {};
  return {
    id, type: "armor", system: { equipped: true, armorType: "simple" },
    getFlag: (scope, key) => flags[`${scope}.${key}`]
  };
};

const mod = (id, installedOn, { reformationSongMod = false } = {}) => {
  const flags = reformationSongMod ? { "warhammer-dbc.reformationSongMod": true } : {};
  return {
    id, type: "armorMod", name: `Мод-${id}`,
    system: { installedOn, category: "armor", activatable: false, active: false, effects: { apAll: 1 } },
    getFlag: (scope, key) => flags[`${scope}.${key}`]
  };
};

describe("getInstalledArmorMods — глушение под Reformation Song", () => {
  it("без флага суппрессии видит все моды как обычно", () => {
    const a = armor("armor-1", false);
    const m1 = mod("m1", "armor-1");
    const m2 = mod("m2", "armor-1", { reformationSongMod: true });
    const actor = actorWith(a, m1, m2);
    expect(getInstalledArmorMods(actor, a).map(m => m.id).sort()).toEqual(["m1", "m2"]);
  });

  it("с флагом суппрессии видит только собственные моды Reformation Song", () => {
    const a = armor("armor-1", true);
    const foreign = mod("foreign", "armor-1");
    const own = mod("own", "armor-1", { reformationSongMod: true });
    const actor = actorWith(a, foreign, own);
    expect(getInstalledArmorMods(actor, a).map(m => m.id)).toEqual(["own"]);
  });

  it("суппрессия одной брони не трогает моды другой брони того же актора", () => {
    const suppressed = armor("armor-1", true);
    const normal = armor("armor-2", false);
    const foreignOnSuppressed = mod("f1", "armor-1");
    const foreignOnNormal = mod("f2", "armor-2");
    const actor = actorWith(suppressed, normal, foreignOnSuppressed, foreignOnNormal);
    expect(getInstalledArmorMods(actor, suppressed)).toHaveLength(0);
    expect(getInstalledArmorMods(actor, normal).map(m => m.id)).toEqual(["f2"]);
  });
});

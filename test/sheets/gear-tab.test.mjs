import { describe, it, expect, beforeEach } from "vitest";
import { listenerRoot, resetCaptured } from "../support/foundry-stub.mjs";
import {
  activateGearListeners,
  equipItem,
  installGearMod,
  setShieldHand,
  setWeaponHand,
  setWeaponLoadedAmmo,
  toggleGearModActive,
  toggleShieldRaised,
  uninstallGearMod
} from "../../module/sheets/tabs/gear.mjs";

function item({ id = "item-1", name = "Предмет", system = {}, raised = false } = {}) {
  const flags = { shieldRaised: raised };
  const it = {
    id,
    name,
    system,
    updates: [],
    embeddedUpdates: [],
    flags,
    effects: { contents: [] },
    sheet: { rendered: 0, render: () => { it.sheet.rendered += 1; } },
    update: async data => {
      it.updates.push(data);
      // Настоящий документ правку сразу применяет, и следом за ним состояние
      // пересчитывают другие: модификации смотрят на надетость носителя
      // (isItemActive). Заглушка, только запоминающая правку, этот порядок
      // спрятала бы.
      for (const [path, value] of Object.entries(data)) {
        const keys = path.split(".");
        let target = it;
        for (const key of keys.slice(0, -1)) target = (target[key] ??= {});
        target[keys.at(-1)] = value;
      }
      return data;
    },
    updateEmbeddedDocuments: async (type, docs) => {
      it.embeddedUpdates.push({ type, docs });
      return docs;
    },
    getFlag: (_scope, key) => flags[key],
    setFlag: async (_scope, key, value) => {
      flags[key] = value;
      return value;
    }
  };
  return it;
}

function actor(items = []) {
  const list = [...items];
  list.get = id => list.find(i => i.id === id) ?? null;
  return { id: "actor-1", name: "Воин", items: list };
}

function event({ itemId = "item-1", checked = false, value = "", hand = "left" } = {}) {
  return {
    preventDefault: () => {},
    stopPropagation: () => {},
    target: { closest: () => null },
    currentTarget: {
      checked,
      value,
      dataset: { itemId, hand }
    }
  };
}

beforeEach(resetCaptured);

describe("gear tab helpers", () => {
  it("equipItem обновляет equipped и синхронизирует ActiveEffect", async () => {
    const weapon = item({ system: { equipped: false } });
    weapon.effects.contents = [{ id: "fx-1", disabled: true }];

    await equipItem(weapon, true);

    expect(weapon.updates[0]).toEqual({ "system.equipped": true });
    expect(weapon.embeddedUpdates[0]).toEqual({
      type: "ActiveEffect",
      docs: [{ _id: "fx-1", disabled: false }]
    });
  });

  it("снятая броня гасит и эффекты установленных на неё модификаций", async () => {
    // Их состояние зависит от носителя (isItemActive), а update приходит ему —
    // сами они о снятии не узнают и продолжали бы давать AP из рюкзака.
    const armor = item({ id: "armor-1", system: { equipped: true } });
    armor.type = "armor";
    const mod = item({ id: "mod-1", name: "Керамит", system: { installedOn: "armor-1" } });
    mod.type = "armorMod";
    mod.effects.contents = [{ id: "fx-1", disabled: false }];
    const owner = actor([armor, mod]);
    armor.parent = owner;
    mod.parent   = owner;

    await equipItem(armor, false);

    expect(mod.embeddedUpdates[0]).toEqual({
      type: "ActiveEffect",
      docs: [{ _id: "fx-1", disabled: true }]
    });
  });

  it("setShieldHand записывает руку щита (единый флаг heldHand, module/rules/hands.mjs)", async () => {
    const shield = item();

    await setShieldHand(shield, "right");

    expect(shield.flags.heldHand).toBe("right");
  });

  it("setWeaponHand записывает руку оружия, повторный клик той же рукой снимает", async () => {
    const weapon = item();

    await setWeaponHand(weapon, "right");
    expect(weapon.flags.heldHand).toBe("right");

    await setWeaponHand(weapon, "right");
    expect(weapon.flags.heldHand).toBe("");

    await setWeaponHand(weapon, "left");
    expect(weapon.flags.heldHand).toBe("left");
  });

  it("toggleShieldRaised переключает поднятый щит", async () => {
    const shield = item({ name: "Ростовой щит", raised: false });

    await toggleShieldRaised(shield);
    await toggleShieldRaised(shield);

    expect(shield.flags.shieldRaised).toBe(false);
  });

  it("setWeaponLoadedAmmo записывает выбранный боеприпас", async () => {
    const weapon = item();

    await setWeaponLoadedAmmo(weapon, "ammo-1");

    expect(weapon.updates[0]).toEqual({ "system.loadedAmmoId": "ammo-1" });
  });

  it("installGearMod ставит улучшение на носителя, а пустой выбор игнорирует", async () => {
    const mod = item({ system: { installedOn: "", activatable: false } });

    await installGearMod(mod, "");
    expect(mod.updates).toEqual([]);

    await installGearMod(mod, "host-1");
    expect(mod.updates[0]).toEqual({ "system.installedOn": "host-1" });
  });

  it("uninstallGearMod снимает улучшение и гасит включаемую систему", async () => {
    const mod = item({ system: { installedOn: "host-1", activatable: true, active: true } });
    mod.effects.contents = [{ id: "fx-1", disabled: false }];

    await uninstallGearMod(mod);

    expect(mod.updates[0]).toEqual({ "system.installedOn": "", "system.active": false });
    expect(mod.embeddedUpdates[0]).toEqual({
      type: "ActiveEffect",
      docs: [{ _id: "fx-1", disabled: true }]
    });
  });

  it("toggleGearModActive переключает систему туда и обратно", async () => {
    const mod = item({ system: { installedOn: "host-1", activatable: true, active: false } });

    await toggleGearModActive(mod);
    expect(mod.updates[0]).toEqual({ "system.active": true });

    mod.system.active = true;                    // документ обновился — читаем новое состояние
    await toggleGearModActive(mod);
    expect(mod.updates[1]).toEqual({ "system.active": false });
  });
});

describe("gear tab listeners", () => {
  it("activateGearListeners привязывает обработчики с actor-only API", async () => {
    const root = listenerRoot();
    const handlers = root.handlers;
    const weapon = item({ id: "weapon-1" });
    const armor = item({ id: "armor-1" });
    const shield = item({ id: "shield-1" });
    const a = actor([weapon, armor, shield]);
    const calls = [];

    activateGearListeners(root, a, {
      reloadWeapon: (...args) => calls.push(["reload", ...args]),
      toggleShield: (...args) => calls.push(["toggle", ...args]),
      rollShieldActivation: (...args) => calls.push(["roll", ...args]),
      repairShield: (...args) => calls.push(["repair", ...args])
    });

    await handlers[".weapon-equip-cb:change"](event({ itemId: "weapon-1", checked: true }));
    await handlers[".armor-equip-cb:change"](event({ itemId: "armor-1", checked: true }));
    await handlers[".shield-hand-btn:click"](event({ itemId: "shield-1", hand: "right" }));
    await handlers[".weapon-hand-btn:click"](event({ itemId: "weapon-1", hand: "right" }));
    await handlers[".shield-raise-btn:click"](event({ itemId: "shield-1" }));
    await handlers[".weapon-ammo-select:change"](event({ itemId: "weapon-1", value: "ammo-2" }));
    await handlers[".weapon-reload-btn:click"](event({ itemId: "weapon-1" }));
    await handlers[".shield-toggle-btn:click"](event({ itemId: "shield-1" }));
    await handlers[".shield-roll-btn:click"](event({ itemId: "shield-1" }));
    await handlers[".shield-repair-btn:click"](event({ itemId: "shield-1" }));
    handlers[".shield-row:dblclick"](event({ itemId: "shield-1" }));
    await handlers[".gear-mod-install:change"](event({ itemId: "armor-1", value: "weapon-1" }));
    await handlers[".gear-mod-uninstall:click"](event({ itemId: "armor-1" }));
    await handlers[".armormod-active-toggle:click"](event({ itemId: "armor-1" }));

    expect(weapon.updates).toContainEqual({ "system.equipped": true });
    expect(weapon.updates).toContainEqual({ "system.loadedAmmoId": "ammo-2" });
    expect(armor.updates[0]).toEqual({ "system.equipped": true });
    expect(armor.updates.slice(1)).toEqual([
      { "system.installedOn": "weapon-1" },
      { "system.installedOn": "", "system.active": false },
      { "system.active": true }
    ]);
    expect(shield.flags.heldHand).toBe("right");
    expect(shield.flags.shieldRaised).toBe(true);
    expect(weapon.flags.heldHand).toBe("right");
    expect(shield.sheet.rendered).toBe(1);
    expect(calls.map(c => c[0])).toEqual(["reload", "toggle", "roll", "repair"]);
    expect(calls.every(c => c[1] === a)).toBe(true);
  });
});

// test/combat/reformation-song.test.mjs
//
// module/combat/reformation-song.mjs (wdbc-vwfk) — Reformation Song/Песня
// Изменений: до F.b предметов (Оружие/Броня/Снаряжение), per-target
// Восстановление/Разрушение, лимит 3 раза за сессию (фиксированный, не F.b).

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";

import { describe, it, expect, afterEach } from "vitest";
import {
  hasReformationSong, reformationSongMax, reformationSongAvailable,
  reformationSongTargetCount, reformationSongRadius,
  applyReformationSong, clearReformationSongBuffs, clearExpiredGearMalfunction
} from "../../module/combat/reformation-song.mjs";

let nextId = 1;

function bonesinger({ hasTalent = true, felBonus = 4, wpBonus = 3 } = {}) {
  const flags = {};
  const items = hasTalent ? [{ type: "talent", name: "Reformation Song / Песня Изменений" }] : [];
  return {
    name: "Певец", items,
    system: { characteristics: { fel: { bonus: felBonus }, wp: { bonus: wpBonus } } },
    getFlag: (scope, key) => flags[`${scope}.${key}`],
    setFlag: async (scope, key, value) => { flags[`${scope}.${key}`] = value; }
  };
}

/** Носитель предметов — тот же приём, что vehicle() в song-of-swiftness.test.mjs. */
function owner({ name = "Носитель", ablativeMax = 0, ablative = 0 } = {}) {
  const items = [];
  items.get = id => items.find(i => i.id === id) ?? null;
  const actor = {
    name, items,
    system: { wounds: { ablativeMax, ablative } },
    createEmbeddedDocuments: async (_type, docs) => {
      const created = docs.map(d => ({
        id: `item-${nextId++}`, ...structuredClone(d), parent: actor,
        getFlag: (scope, key) => (d.flags?.[scope]?.[key]), setFlag: async () => {}, unsetFlag: async () => {}
      }));
      items.push(...created);
      captured.created.push(...docs);
      return created;
    },
    deleteEmbeddedDocuments: async (_type, ids) => {
      for (const id of ids) {
        const idx = items.findIndex(i => i.id === id);
        if (idx >= 0) items.splice(idx, 1);
      }
    },
    update: async patch => {
      for (const [path, value] of Object.entries(patch)) {
        const key = path.replace(/^system\.wounds\./, "");
        actor.system.wounds[key] = value;
      }
    }
  };
  return actor;
}

/** Один предмет-цель (weapon/armor/gear) с рабочими update/getFlag/setFlag. */
function makeItem(type, system, ownerActor) {
  const flags = {};
  const item = {
    id: `item-${nextId++}`, name: `Тест-${type}`, type, system: structuredClone(system),
    parent: ownerActor,
    update: async patch => {
      for (const [path, value] of Object.entries(patch)) {
        const key = path.replace(/^system\./, "");
        item.system[key] = value;
      }
    },
    getFlag: (scope, key) => flags[`${scope}.${key}`],
    setFlag: async (scope, key, value) => { flags[`${scope}.${key}`] = value; },
    unsetFlag: async (scope, key) => { delete flags[`${scope}.${key}`]; }
  };
  ownerActor.items.push(item);
  return item;
}

afterEach(() => { resetCaptured(); globalThis.game.combat = undefined; });

describe("hasReformationSong / reformationSongMax / reformationSongTargetCount / reformationSongRadius", () => {
  it("определяет владение Талантом", () => {
    expect(hasReformationSong(bonesinger({ hasTalent: true }))).toBe(true);
    expect(hasReformationSong(bonesinger({ hasTalent: false }))).toBe(false);
  });
  it("лимит сессии — фиксированный 3, не зависит от F.b", () => {
    expect(reformationSongMax()).toBe(3);
  });
  it("до F.b предметов за каст, минимум 1", () => {
    expect(reformationSongTargetCount(bonesinger({ felBonus: 5 }))).toBe(5);
    expect(reformationSongTargetCount(bonesinger({ felBonus: 0 }))).toBe(1);
  });
  it("радиус — W.b метров", () => {
    expect(reformationSongRadius(bonesinger({ wpBonus: 4 }))).toBe(4);
  });
});

describe("reformationSongAvailable", () => {
  it("до 3 раз за сессию", async () => {
    const caster = bonesinger();
    const target = owner();
    const armor = makeItem("armor", { head: 0, body: 0, leftArm: 0, rightArm: 0, leftLeg: 0, rightLeg: 0 }, target);
    for (let i = 0; i < 3; i++) {
      expect(reformationSongAvailable(caster)).toBe(true);
      await applyReformationSong(caster, [{ item: armor, mode: "restore" }]);
    }
    expect(reformationSongAvailable(caster)).toBe(false);
  });
});

describe("applyReformationSong — Броня", () => {
  it("Восстановление создаёт 2 armorMod (apAll=F.b и apAll=⌈F.b/2⌉)", async () => {
    const caster = bonesinger({ felBonus: 5 });
    const target = owner();
    const armor = makeItem("armor", { head: 5, body: 5, leftArm: 5, rightArm: 5, leftLeg: 5, rightLeg: 5 }, target);
    await applyReformationSong(caster, [{ item: armor, mode: "restore" }]);

    const mods = target.items.filter(i => i.type === "armorMod");
    expect(mods).toHaveLength(2);
    expect(mods.map(m => m.system.effects.apAll).sort((a, b) => a - b)).toEqual([3, 5]);
    expect(mods.every(m => m.system.installedOn === armor.id)).toBe(true);
  });

  it("Разрушение создаёт armorMod с apAll=−F.b", async () => {
    const caster = bonesinger({ felBonus: 4 });
    const target = owner();
    const armor = makeItem("armor", {}, target);
    await applyReformationSong(caster, [{ item: armor, mode: "destroy" }]);

    const mods = target.items.filter(i => i.type === "armorMod");
    expect(mods).toHaveLength(1);
    expect(mods[0].system.effects.apAll).toBe(-4);
  });

  it("deleteCombat снимает моды AP брони со всех комбатантов боя", async () => {
    const caster = bonesinger();
    const target = owner();
    const armor = makeItem("armor", {}, target);
    await applyReformationSong(caster, [{ item: armor, mode: "restore" }]);
    expect(target.items.filter(i => i.type === "armorMod")).toHaveLength(2);

    await clearReformationSongBuffs({ combatants: [{ actor: target }] });
    expect(target.items.filter(i => i.type === "armorMod")).toHaveLength(0);
  });

  it("Разрушение ставит флаг глушения чужих модов на этой броне и создаёт свой мод с флагом reformationSongMod", async () => {
    const caster = bonesinger();
    const target = owner();
    const armor = makeItem("armor", {}, target);
    await applyReformationSong(caster, [{ item: armor, mode: "destroy" }]);

    expect(armor.getFlag("warhammer-dbc", "reformationSongSuppressMods")).toBe(true);
    const mod = target.items.find(i => i.type === "armorMod");
    expect(mod.getFlag("warhammer-dbc", "reformationSongMod")).toBe(true);
  });

  it("Разрушение нивелирует Аблативные Раны актора, если пул был", async () => {
    const caster = bonesinger();
    const target = owner({ ablativeMax: 10, ablative: 7 });
    const armor = makeItem("armor", {}, target);
    await applyReformationSong(caster, [{ item: armor, mode: "destroy" }]);
    expect(target.system.wounds.ablativeMax).toBe(0);
    expect(target.system.wounds.ablative).toBe(0);
  });

  it("Разрушение без Аблативного пула не трогает system.wounds", async () => {
    const caster = bonesinger();
    const target = owner({ ablativeMax: 0 });
    const armor = makeItem("armor", {}, target);
    await applyReformationSong(caster, [{ item: armor, mode: "destroy" }]);
    expect(target.system.wounds.ablativeMax).toBe(0);
  });

  it("deleteCombat снимает глушение модов и возвращает Аблативный потолок", async () => {
    const caster = bonesinger();
    const target = owner({ ablativeMax: 8 });
    const armor = makeItem("armor", {}, target);
    await applyReformationSong(caster, [{ item: armor, mode: "destroy" }]);
    expect(armor.getFlag("warhammer-dbc", "reformationSongSuppressMods")).toBe(true);
    expect(target.system.wounds.ablativeMax).toBe(0);

    await clearReformationSongBuffs({ combatants: [{ actor: target }] });
    expect(armor.getFlag("warhammer-dbc", "reformationSongSuppressMods")).toBeUndefined();
    expect(target.system.wounds.ablativeMax).toBe(8);
  });
});

describe("applyReformationSong — Оружие", () => {
  it("Восстановление добавляет Reinforced и снимает destroyed", async () => {
    const caster = bonesinger({ felBonus: 3 });
    const target = owner();
    const weapon = makeItem("weapon", { weaponClass: "melee", weaponProps: [], destroyed: true }, target);
    await applyReformationSong(caster, [{ item: weapon, mode: "restore" }]);

    expect(weapon.system.destroyed).toBe(false);
    expect(weapon.system.weaponProps.some(p => p.key === "reinforced")).toBe(true);
  });

  it("Восстановление не дублирует Reinforced, если он уже был", async () => {
    const caster = bonesinger();
    const target = owner();
    const weapon = makeItem("weapon", { weaponClass: "melee", weaponProps: [{ key: "reinforced" }] }, target);
    await applyReformationSong(caster, [{ item: weapon, mode: "restore" }]);
    expect(weapon.system.weaponProps.filter(p => p.key === "reinforced")).toHaveLength(1);
  });

  it("Разрушение рукопашного с Reinforced снимает его; без Reinforced — уничтожает", async () => {
    const caster = bonesinger();
    const target = owner();
    const reinforcedWeapon = makeItem("weapon", { weaponClass: "melee", weaponProps: [{ key: "reinforced" }] }, target);
    const plainWeapon = makeItem("weapon", { weaponClass: "melee", weaponProps: [] }, target);
    await applyReformationSong(caster, [
      { item: reinforcedWeapon, mode: "destroy" },
      { item: plainWeapon, mode: "destroy" }
    ]);
    expect(reinforcedWeapon.system.weaponProps.some(p => p.key === "reinforced")).toBe(false);
    expect(plainWeapon.system.destroyed).toBe(true);
  });

  it("Разрушение стрелкового заклинивает (реальное состояние), не трогает destroyed/weaponProps", async () => {
    const caster = bonesinger();
    const target = owner();
    const ranged = makeItem("weapon", { weaponClass: "las", weaponProps: [], destroyed: false }, target);
    await applyReformationSong(caster, [{ item: ranged, mode: "destroy" }]);
    expect(ranged.system.jammed).toBe(true);
    expect(ranged.system.destroyed).toBe(false);
    expect(ranged.system.weaponProps).toEqual([]);
  });

  it("Разрушение стрелкового вне боя не ставит блокировку расклинивания (jamLockedRound=0)", async () => {
    const caster = bonesinger();
    const target = owner();
    const ranged = makeItem("weapon", { weaponClass: "las", weaponProps: [] }, target);
    globalThis.game.combat = undefined;
    await applyReformationSong(caster, [{ item: ranged, mode: "destroy" }]);
    expect(ranged.system.jamLockedRound).toBe(0);
  });

  it("Разрушение стрелкового в бою блокирует Расклин до конца текущего Раунда", async () => {
    const caster = bonesinger();
    const target = owner();
    const ranged = makeItem("weapon", { weaponClass: "las", weaponProps: [] }, target);
    globalThis.game.combat = { round: 2 };
    await applyReformationSong(caster, [{ item: ranged, mode: "destroy" }]);
    expect(ranged.system.jamLockedRound).toBe(3);
  });

  it("Восстановление расклинивает (реальное состояние снимается)", async () => {
    const caster = bonesinger();
    const target = owner();
    const weapon = makeItem("weapon", { weaponClass: "melee", weaponProps: [], jammed: true, jamLockedRound: 5 }, target);
    await applyReformationSong(caster, [{ item: weapon, mode: "restore" }]);
    expect(weapon.system.jammed).toBe(false);
    expect(weapon.system.jamLockedRound).toBe(0);
  });

  it("deleteCombat возвращает временно снятый/добавленный Reinforced", async () => {
    const caster = bonesinger();
    const target = owner();
    const weapon = makeItem("weapon", { weaponClass: "melee", weaponProps: [] }, target);
    await applyReformationSong(caster, [{ item: weapon, mode: "restore" }]);
    expect(weapon.system.weaponProps.some(p => p.key === "reinforced")).toBe(true);

    await clearReformationSongBuffs({ combatants: [{ actor: target }] });
    expect(weapon.system.weaponProps.some(p => p.key === "reinforced")).toBe(false);
  });
});

describe("applyReformationSong — Снаряжение", () => {
  it("Восстановление снимает malfunctioning и повышает качество на 1 (до Best)", async () => {
    const caster = bonesinger();
    const target = owner();
    const gear = makeItem("gear", { quality: "common", malfunctioning: true }, target);
    await applyReformationSong(caster, [{ item: gear, mode: "restore" }]);
    expect(gear.system.malfunctioning).toBe(false);
    expect(gear.system.quality).toBe("good");
  });

  it("Восстановление на Best.Q не повышает выше потолка", async () => {
    const caster = bonesinger();
    const target = owner();
    const gear = makeItem("gear", { quality: "best" }, target);
    await applyReformationSong(caster, [{ item: gear, mode: "restore" }]);
    expect(gear.system.quality).toBe("best");
  });

  it("Разрушение ставит malfunctioning и понижает качество на 1 (до Poor)", async () => {
    const caster = bonesinger();
    const target = owner();
    const gear = makeItem("gear", { quality: "good" }, target);
    await applyReformationSong(caster, [{ item: gear, mode: "destroy" }]);
    expect(gear.system.malfunctioning).toBe(true);
    expect(gear.system.quality).toBe("common");
  });

  it("clearExpiredGearMalfunction снимает флаг в начале Хода владельца", async () => {
    const caster = bonesinger();
    const target = owner();
    const gear = makeItem("gear", { quality: "common" }, target);
    await applyReformationSong(caster, [{ item: gear, mode: "destroy" }]);
    expect(gear.system.malfunctioning).toBe(true);

    await clearExpiredGearMalfunction(target);
    expect(gear.system.malfunctioning).toBe(false);
  });

  it("deleteCombat возвращает временно изменённое качество", async () => {
    const caster = bonesinger();
    const target = owner();
    const gear = makeItem("gear", { quality: "common" }, target);
    await applyReformationSong(caster, [{ item: gear, mode: "destroy" }]);
    expect(gear.system.quality).toBe("poor");

    await clearReformationSongBuffs({ combatants: [{ actor: target }] });
    expect(gear.system.quality).toBe("common");
  });
});

describe("applyReformationSong — смешанный набор целей", () => {
  it("обрабатывает несколько предметов разных категорий одним кастом", async () => {
    const caster = bonesinger({ felBonus: 4 });
    const target = owner();
    const armor = makeItem("armor", {}, target);
    const weapon = makeItem("weapon", { weaponClass: "melee", weaponProps: [] }, target);
    const gear = makeItem("gear", { quality: "common" }, target);

    await applyReformationSong(caster, [
      { item: armor, mode: "restore" },
      { item: weapon, mode: "restore" },
      { item: gear, mode: "destroy" }
    ]);

    expect(target.items.filter(i => i.type === "armorMod")).toHaveLength(2);
    expect(weapon.system.weaponProps.some(p => p.key === "reinforced")).toBe(true);
    expect(gear.system.malfunctioning).toBe(true);
    expect(captured.chat).toHaveLength(1);
  });
});

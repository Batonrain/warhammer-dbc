// test/combat/song-of-swiftness.test.mjs
//
// module/combat/song-of-swiftness.mjs (wdbc-sk8s) — Song of Swiftness/Песня
// Стремительности: +SPD/Манёвренность технике (одна цель / область) до
// конца боя, снижено у сверхтяжёлой (Размер 6+) без Мастера, снимается по
// deleteCombat, лимит 3 раза за сессию (фиксированный, не F.b).

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";

import { describe, it, expect, afterEach } from "vitest";
import {
  hasSongOfSwiftness, songOfSwiftnessMax, songOfSwiftnessAvailable, songOfSwiftnessBonus,
  applySongOfSwiftnessSingle, applySongOfSwiftnessArea, clearSongOfSwiftnessBuffs
} from "../../module/combat/song-of-swiftness.mjs";

const grid = { size: 100, distance: 2 };
let nextId = 1;

function bonesinger({ hasTalent = true, felBonus = 4, paths = [] } = {}) {
  const flags = {};
  const items = hasTalent ? [{ type: "talent", name: "Song of Swiftness / Песня Стремительности" }] : [];
  return {
    name: "Певец", items, system: { characteristics: { fel: { bonus: felBonus } }, paths },
    getFlag: (scope, key) => flags[`${scope}.${key}`],
    setFlag: async (scope, key, value) => { flags[`${scope}.${key}`] = value; }
  };
}

function vehicle({ uuid = "Actor.v1", size = 3 } = {}) {
  const items = [];
  items.get = id => items.find(i => i.id === id) ?? null;
  const flags = {};
  const data = {
    name: `Техника-${uuid}`, uuid, type: "vehicle", system: { size }, items,
    createEmbeddedDocuments: async (_type, docs) => {
      const created = docs.map(d => ({ id: `item-${nextId++}`, ...structuredClone(d) }));
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
    getFlag: (scope, key) => flags[`${scope}.${key}`],
    setFlag: async (scope, key, value) => { flags[`${scope}.${key}`] = value; },
    unsetFlag: async (scope, key) => { delete flags[`${scope}.${key}`]; }
  };
  return data;
}

function token(id, actor, x = 0) {
  return { id, x, y: 0, width: 1, height: 1, hidden: false, actor };
}
function scene(tokens) { return { grid, tokens: { contents: tokens } }; }

afterEach(() => { resetCaptured(); globalThis.game.combat = undefined; });

describe("hasSongOfSwiftness / songOfSwiftnessMax", () => {
  it("определяет владение Талантом", () => {
    expect(hasSongOfSwiftness(bonesinger({ hasTalent: true }))).toBe(true);
    expect(hasSongOfSwiftness(bonesinger({ hasTalent: false }))).toBe(false);
  });
  it("лимит сессии — фиксированный 3, не зависит от F.b", () => {
    expect(songOfSwiftnessMax()).toBe(3);
  });
});

describe("songOfSwiftnessBonus", () => {
  it("одиночная цель, обычная техника — +F.b SPD, +F.b×2 Манёвренность", () => {
    expect(songOfSwiftnessBonus(bonesinger({ felBonus: 4 }), 3, "single")).toEqual({ spd: 4, man: 8 });
  });
  it("область, обычная техника — +½F.b (окр.▲) SPD, +F.b Манёвренность", () => {
    expect(songOfSwiftnessBonus(bonesinger({ felBonus: 5 }), 3, "area")).toEqual({ spd: 3, man: 5 });
  });
  it("сверхтяжёлая (Размер 6+) без Мастера — +⅓F.b (окр.▲) SPD, ½F.b (окр.▲) Манёвренность, любая ветка", () => {
    expect(songOfSwiftnessBonus(bonesinger({ felBonus: 5 }), 6, "single")).toEqual({ spd: 2, man: 3 });
    expect(songOfSwiftnessBonus(bonesinger({ felBonus: 5 }), 6, "area")).toEqual({ spd: 2, man: 3 });
  });
  it("сверхтяжёлая с Мастером — как обычная техника", () => {
    const master = bonesinger({ felBonus: 4, paths: [{ key: "bonesinger", grade: "master" }] });
    expect(songOfSwiftnessBonus(master, 6, "single")).toEqual({ spd: 4, man: 8 });
  });
});

describe("songOfSwiftnessAvailable", () => {
  it("до 3 раз за сессию", async () => {
    const caster = bonesinger();
    const targets = [vehicle({ uuid: "a" }), vehicle({ uuid: "b" }), vehicle({ uuid: "c" })];
    for (const t of targets) {
      expect(songOfSwiftnessAvailable(caster)).toBe(true);
      await applySongOfSwiftnessSingle(caster, t);
    }
    expect(songOfSwiftnessAvailable(caster)).toBe(false);
  });
});

describe("applySongOfSwiftnessSingle / clearSongOfSwiftnessBuffs", () => {
  it("создаёт vehicleTrait с spdMod/manoeuvreMod", async () => {
    const caster = bonesinger({ felBonus: 3 });
    const target = vehicle();
    await applySongOfSwiftnessSingle(caster, target);
    expect(target.items).toHaveLength(1);
    expect(target.items[0].type).toBe("vehicleTrait");
    expect(target.items[0].system.effects).toEqual({ spdMod: 3, manoeuvreMod: 6 });
  });

  it("deleteCombat снимает бонус со всех комбатантов боя", async () => {
    const caster = bonesinger();
    const target = vehicle();
    await applySongOfSwiftnessSingle(caster, target);
    expect(target.items).toHaveLength(1);

    const combat = { combatants: [{ actor: target }] };
    await clearSongOfSwiftnessBuffs(combat);
    expect(target.items).toHaveLength(0);
  });
});

describe("applySongOfSwiftnessArea", () => {
  it("даёт бонус всей технике в радиусе 10 м", async () => {
    const caster = bonesinger({ felBonus: 4 });
    const casterToken = token("c1", caster, 0);
    const near = vehicle({ uuid: "Actor.near" });
    const far  = vehicle({ uuid: "Actor.far" });
    const s = scene([casterToken, token("t1", near, 100), token("t2", far, 10000)]);
    casterToken.parent = s;

    await applySongOfSwiftnessArea(caster, casterToken);
    expect(near.items).toHaveLength(1);
    expect(near.items[0].system.effects).toEqual({ spdMod: 2, manoeuvreMod: 4 });
    expect(far.items).toHaveLength(0);
  });
});

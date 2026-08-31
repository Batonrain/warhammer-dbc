// test/combat/preservation.test.mjs
//
// module/combat/preservation.mjs (wdbc-sk8s) — Preservation/Защита: щит
// технике (одна цель — дефлектор 50, область — купол 35), лимит F.b раз за
// сессию, −10 рейтинга за каждый Размер после 3-ёх (без Мастера).

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";

import { describe, it, expect, afterEach } from "vitest";
import {
  hasPreservation, preservationMax, preservationAvailable, preservationSizeReduction,
  applyPreservationSingle, applyPreservationArea
} from "../../module/combat/preservation.mjs";

const grid = { size: 100, distance: 2 };
let nextId = 1;

function bonesinger({ hasTalent = true, felBonus = 3, paths = [] } = {}) {
  const flags = {};
  const items = hasTalent ? [{ type: "talent", name: "Preservation / Защита" }] : [];
  return {
    name: "Певец", items, system: { characteristics: { fel: { bonus: felBonus } }, paths },
    getFlag: (scope, key) => flags[`${scope}.${key}`],
    setFlag: async (scope, key, value) => { flags[`${scope}.${key}`] = value; }
  };
}

function vehicle({ uuid = "Actor.v1", size = 3 } = {}) {
  const items = [];
  const data = {
    name: `Техника-${uuid}`, uuid, type: "vehicle", system: { size }, items,
    createEmbeddedDocuments: async (_type, docs) => {
      const created = docs.map(d => ({ id: `item-${nextId++}`, ...structuredClone(d) }));
      items.push(...created);
      captured.created.push(...docs);
      return created;
    }
  };
  return data;
}

function token(id, actor, x = 0) {
  return { id, x, y: 0, width: 1, height: 1, hidden: false, actor };
}
function scene(tokens) { return { grid, tokens: { contents: tokens } }; }

afterEach(() => { resetCaptured(); globalThis.game.combat = undefined; });

describe("hasPreservation / preservationMax", () => {
  it("определяет владение Талантом", () => {
    expect(hasPreservation(bonesinger({ hasTalent: true }))).toBe(true);
    expect(hasPreservation(bonesinger({ hasTalent: false }))).toBe(false);
  });
  it("лимит сессии — F.b, минимум 1", () => {
    expect(preservationMax(bonesinger({ felBonus: 5 }))).toBe(5);
    expect(preservationMax(bonesinger({ felBonus: 0 }))).toBe(1);
  });
});

describe("preservationSizeReduction", () => {
  it("Размер ≤ 3 — без снижения", () => {
    expect(preservationSizeReduction(bonesinger(), 3)).toBe(0);
  });
  it("−10 за каждый Размер после 3-ёх", () => {
    expect(preservationSizeReduction(bonesinger(), 4)).toBe(10);
    expect(preservationSizeReduction(bonesinger(), 6)).toBe(30);
  });
  it("Мастер на Пути Певца Кости — без снижения", () => {
    const master = bonesinger({ paths: [{ key: "bonesinger", grade: "master" }] });
    expect(preservationSizeReduction(master, 6)).toBe(0);
  });
});

describe("preservationAvailable", () => {
  it("до F.b раз за сессию", async () => {
    const caster = bonesinger({ felBonus: 1 });
    const target = vehicle();
    expect(preservationAvailable(caster)).toBe(true);
    await applyPreservationSingle(caster, target);
    expect(preservationAvailable(caster)).toBe(false);
  });
});

describe("applyPreservationSingle", () => {
  it("создаёт неперегружаемый щит-дефлектор 1-50/−", async () => {
    const caster = bonesinger();
    const target = vehicle();
    await applyPreservationSingle(caster, target);
    expect(target.items).toHaveLength(1);
    const shield = target.items[0];
    expect(shield.type).toBe("forcefield");
    expect(shield.system.shieldType).toBe("deflector");
    expect(shield.system.shieldNature).toBe("warp");
    expect(shield.system.ratingMax).toBe(50);
    expect(shield.system.currentRating).toBe(50);
    expect(shield.system.overloadThreshold).toBe(0);
    expect(shield.system.equipped).toBe(true);
    expect(shield.system.status).toBe("active");
  });

  it("снижает рейтинг у Размера 4+ без Мастера", async () => {
    const caster = bonesinger();
    const target = vehicle({ size: 5 });
    await applyPreservationSingle(caster, target);
    expect(target.items[0].system.ratingMax).toBe(30); // 50 − 20
  });
});

describe("applyPreservationArea", () => {
  it("даёт щит-купол 1-35/− всей технике в радиусе 10 м", async () => {
    const caster = bonesinger();
    const casterToken = token("c1", caster, 0);
    const near = vehicle({ uuid: "Actor.near" });
    const far  = vehicle({ uuid: "Actor.far" });
    const s = scene([casterToken, token("t1", near, 100), token("t2", far, 10000)]);
    casterToken.parent = s;

    await applyPreservationArea(caster, casterToken);
    expect(near.items).toHaveLength(1);
    expect(near.items[0].system.shieldType).toBe("dome");
    expect(near.items[0].system.ratingMax).toBe(35);
    expect(far.items).toHaveLength(0);
  });
});

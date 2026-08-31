// test/combat/bone-song.test.mjs
//
// module/combat/bone-song.mjs (wdbc-sk8s) — Bone Song/Костяная Песня: ремонт
// техники (одна цель / область), лимит F.b раз за сессию, снижение объёма
// у Размера 4+ без Мастера на Пути Певца Кости.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";

import { describe, it, expect, afterEach } from "vitest";
import {
  hasBoneSong, isBonesingerMaster, boneSongMax, boneSongAvailable,
  boneSongSizeReduction, applyBoneSongSingle, applyBoneSongArea
} from "../../module/combat/bone-song.mjs";

const grid = { size: 100, distance: 2 };

function bonesinger({ hasTalent = true, felBonus = 3, paths = [] } = {}) {
  const flags = {};
  const items = hasTalent ? [{ type: "talent", name: "Bone Song / Костяная Песня" }] : [];
  return {
    name: "Певец", items,
    system: { characteristics: { fel: { bonus: felBonus } }, paths },
    getFlag: (scope, key) => flags[`${scope}.${key}`],
    setFlag: async (scope, key, value) => { flags[`${scope}.${key}`] = value; }
  };
}

function vehicle({ uuid = "Actor.v1", size = 3, structValue = 10, structMax = 30, damageStates = [] } = {}) {
  const data = {
    name: `Техника-${uuid}`, uuid, type: "vehicle",
    system: { size, structure: { value: structValue, max: structMax }, damageStates }
  };
  data.update = async patch => {
    for (const [path, value] of Object.entries(patch)) {
      const parts = path.split(".");
      let cur = data;
      for (const p of parts.slice(0, -1)) { cur[p] ??= {}; cur = cur[p]; }
      cur[parts.at(-1)] = value;
    }
  };
  return data;
}

function token(id, actor, x = 0) {
  return { id, x, y: 0, width: 1, height: 1, hidden: false, actor };
}
function scene(tokens) { return { grid, tokens: { contents: tokens } }; }

afterEach(() => { resetCaptured(); globalThis.game.combat = undefined; });

describe("hasBoneSong / isBonesingerMaster / boneSongMax", () => {
  it("определяет владение Талантом", () => {
    expect(hasBoneSong(bonesinger({ hasTalent: true }))).toBe(true);
    expect(hasBoneSong(bonesinger({ hasTalent: false }))).toBe(false);
  });

  it("Мастер — только grade:master на пути bonesinger", () => {
    expect(isBonesingerMaster(bonesinger({ paths: [{ key: "bonesinger", grade: "master" }] }))).toBe(true);
    expect(isBonesingerMaster(bonesinger({ paths: [{ key: "bonesinger", grade: "next" }] }))).toBe(false);
    expect(isBonesingerMaster(bonesinger({ paths: [{ key: "warlock", grade: "master" }] }))).toBe(false);
    expect(isBonesingerMaster(bonesinger({ paths: [] }))).toBe(false);
  });

  it("лимит сессии — F.b, минимум 1", () => {
    expect(boneSongMax(bonesinger({ felBonus: 4 }))).toBe(4);
    expect(boneSongMax(bonesinger({ felBonus: 0 }))).toBe(1);
  });
});

describe("boneSongSizeReduction", () => {
  it("Размер < 4 — без снижения", () => {
    expect(boneSongSizeReduction(bonesinger(), 3)).toBe(0);
  });
  it("Размер 4+ без Мастера — Размер+1", () => {
    expect(boneSongSizeReduction(bonesinger(), 4)).toBe(5);
    expect(boneSongSizeReduction(bonesinger(), 6)).toBe(7);
  });
  it("Размер 4+ с Мастером — без снижения", () => {
    const master = bonesinger({ paths: [{ key: "bonesinger", grade: "master" }] });
    expect(boneSongSizeReduction(master, 6)).toBe(0);
  });
});

describe("boneSongAvailable", () => {
  it("до F.b раз за сессию", async () => {
    const caster = bonesinger({ felBonus: 1 });
    const target = vehicle();
    expect(boneSongAvailable(caster)).toBe(true);
    captured.nextRoll = 5;
    await applyBoneSongSingle(caster, target);
    expect(boneSongAvailable(caster)).toBe(false);
  });
});

describe("applyBoneSongSingle", () => {
  it("восстанавливает структуру (капается в max) и снимает все поломки", async () => {
    const caster = bonesinger({ felBonus: 3 });
    const target = vehicle({ structValue: 25, structMax: 30, damageStates: [{ id: "d1" }, { id: "d2" }] });
    captured.dice = [8]; // 1d10 → 8, +3 F.b = 11, капается до max-value = 5
    await applyBoneSongSingle(caster, target);
    expect(target.system.structure.value).toBe(30);
    expect(target.system.damageStates).toEqual([]);
  });

  it("снижает восстановление у Размера 4+ без Мастера", async () => {
    const caster = bonesinger({ felBonus: 3 });
    const target = vehicle({ size: 6, structValue: 0, structMax: 100 });
    captured.dice = [1]; // 1d10=1, +3 = 4, −(6+1)=7 → floor 0
    await applyBoneSongSingle(caster, target);
    expect(target.system.structure.value).toBe(0);
  });
});

describe("applyBoneSongArea", () => {
  it("чинит всю технику в радиусе 10 м, по одной поломке каждой", async () => {
    const caster = bonesinger({ felBonus: 2 });
    const casterToken = token("c1", caster, 0);
    const near = vehicle({ uuid: "Actor.near", structValue: 0, structMax: 20, damageStates: [{ id: "a" }, { id: "b" }] });
    const far  = vehicle({ uuid: "Actor.far", structValue: 0, structMax: 20 });
    const s = scene([casterToken, token("t1", near, 100), token("t2", far, 10000)]);
    casterToken.parent = s;

    captured.dice = [4]; // 1d5=4, +ceil(2/2)=1 → 5
    await applyBoneSongArea(caster, casterToken);
    expect(near.system.structure.value).toBe(5);
    expect(near.system.damageStates).toEqual([{ id: "b" }]);
    expect(far.system.structure.value).toBe(0);
  });
});

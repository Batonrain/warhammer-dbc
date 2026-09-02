// test/combat/recoil-pool.test.mjs
//
// «Отскок» (стр. 12, wdbc-9wvm): дистанция за Раунд суммарно по всем
// Отскокам вместо нивеляции Уклонения от стрелковой атаки — SPD м лимит,
// растущий доп. ОД в конце Хода (п.7), сбрасывается тем же тактом, что
// resetActionEconomy.

import { describe, it, expect, beforeEach } from "vitest";
import { resetCaptured } from "../support/foundry-stub.mjs";
import {
  spdMeters, recoilLimit, recoilRemaining, resetRecoilPool, spendRecoil, grantRecoilBonus
} from "../../module/combat/recoil-pool.mjs";

function actor({ halfMove = 4, type = "character" } = {}) {
  const store = {};
  return {
    type,
    system: { movement: { halfMove } },
    getFlag: (scope, key) => store[`${scope}.${key}`],
    setFlag: async (scope, key, value) => { store[`${scope}.${key}`] = value; },
    update: async data => {
      for (const [path, value] of Object.entries(data)) {
        if (path === "flags.warhammer-dbc.-=recoilPool") delete store["warhammer-dbc.recoilPool"];
      }
    }
  };
}

beforeEach(() => {
  resetCaptured();
  globalThis.game.combat = undefined;
});

describe("вне активного Encounter — не считается вовсе", () => {
  it("recoilRemaining бесконечен", () => {
    const a = actor();
    expect(recoilRemaining(a)).toBe(Infinity);
  });

  it("spendRecoil не трогает пул, отдаёт запрошенное как потраченное", async () => {
    const a = actor();
    const spent = await spendRecoil(a, 999);
    expect(spent).toBe(999);
    expect(a.getFlag("warhammer-dbc", "recoilPool")).toBeUndefined();
  });
});

describe("в бою — лимит SPD м, тратится и зажимается остатком", () => {
  beforeEach(() => {
    globalThis.game.combat = { started: true, id: "c1", combatant: { id: "cbt-1" } };
  });

  it("recoilLimit/recoilRemaining по умолчанию равны SPD (halfMove)", () => {
    const a = actor({ halfMove: 4 });
    expect(recoilLimit(a)).toBe(4);
    expect(recoilRemaining(a)).toBe(4);
  });

  it("spendRecoil списывает и возвращает реально потраченное", async () => {
    const a = actor({ halfMove: 4 });
    const spent = await spendRecoil(a, 3);
    expect(spent).toBe(3);
    expect(recoilRemaining(a)).toBe(1);
  });

  it("нельзя потратить больше остатка — зажимается", async () => {
    const a = actor({ halfMove: 4 });
    const spent = await spendRecoil(a, 10);
    expect(spent).toBe(4);
    expect(recoilRemaining(a)).toBe(0);
  });

  it("копится за несколько трат в одном Раунде", async () => {
    const a = actor({ halfMove: 6 });
    await spendRecoil(a, 2);
    await spendRecoil(a, 3);
    expect(recoilRemaining(a)).toBe(1);
  });

  it("исчерпанный пул — 0 остаётся 0, не уходит в минус", async () => {
    const a = actor({ halfMove: 2 });
    await spendRecoil(a, 2);
    const spent = await spendRecoil(a, 1);
    expect(spent).toBe(0);
    expect(recoilRemaining(a)).toBe(0);
  });
});

describe("grantRecoilBonus (п.7): непотраченное ОД → +SPD м к пределу Раунда", () => {
  beforeEach(() => {
    globalThis.game.combat = { started: true, id: "c1", combatant: { id: "cbt-1" } };
  });

  it("одно ОД — предел растёт на SPD", async () => {
    const a = actor({ halfMove: 4 });
    await grantRecoilBonus(a, 1);
    expect(recoilLimit(a)).toBe(8);
    expect(recoilRemaining(a)).toBe(8);
  });

  it("несколько ОД — на каждое по SPD, а не разом", async () => {
    const a = actor({ halfMove: 3 });
    await grantRecoilBonus(a, 2);
    expect(recoilLimit(a)).toBe(9); // 3 база + 2×3 бонуса
  });

  it("бонус остаётся доступным после частичной траты, не пересчитывается", async () => {
    const a = actor({ halfMove: 4 });
    await grantRecoilBonus(a, 1); // предел 8
    await spendRecoil(a, 5);
    expect(recoilRemaining(a)).toBe(3);
  });

  it("0 или отрицательное ОД — ничего не меняет", async () => {
    const a = actor({ halfMove: 4 });
    const bonus = await grantRecoilBonus(a, 0);
    expect(bonus).toBe(0);
    expect(recoilLimit(a)).toBe(4);
  });
});

describe("resetRecoilPool: сброс сжигает и spent, и bonus", () => {
  beforeEach(() => {
    globalThis.game.combat = { started: true, id: "c1", combatant: { id: "cbt-1" } };
  });

  it("после сброса лимит и остаток снова равны голому SPD", async () => {
    const a = actor({ halfMove: 4 });
    await grantRecoilBonus(a, 1);
    await spendRecoil(a, 6);
    expect(recoilRemaining(a)).toBe(2);

    await resetRecoilPool(a);

    expect(recoilLimit(a)).toBe(4);
    expect(recoilRemaining(a)).toBe(4);
  });

  it("пустой пул — resetRecoilPool не зовёт update вовсе", async () => {
    const a = actor({ halfMove: 4 });
    let updateCalled = false;
    a.update = async () => { updateCalled = true; };
    await resetRecoilPool(a);
    expect(updateCalled).toBe(false);
  });
});

describe("spdMeters", () => {
  it("читает system.movement.halfMove, 0 по умолчанию", () => {
    expect(spdMeters(actor({ halfMove: 5 }))).toBe(5);
    expect(spdMeters({ system: {} })).toBe(0);
    expect(spdMeters(null)).toBe(0);
  });
});

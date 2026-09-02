// test/combat/cover-ap.test.mjs
//
// coverApForToken (wdbc-9wvm, «Отскок в Укрытие», стр. 12) — AP зоны
// Укрытия, в которой СЕЙЧАС стоит токен, без проверки линии огня (в отличие
// от coverBonusForShot — тот штрафует ПОРОГ атаки ДО Уклонения и поэтому
// обязан знать стрелка; здесь игрок уже объявил «отскочил сюда сам»).

import { describe, it, expect } from "vitest";
import "../support/foundry-stub.mjs";
import { coverApForToken } from "../../module/combat/cover.mjs";
import { COVER_TYPE } from "../../module/regions/cover.mjs";

function behavior({ type = COVER_TYPE, disabled = false, coverAp = 0 } = {}) {
  return { type, disabled, system: { coverAp } };
}

function tokenIn(regions) {
  return { document: { regions: new Set(regions) } };
}

describe("coverApForToken", () => {
  it("нет регионов — 0", () => {
    expect(coverApForToken(tokenIn([]))).toBe(0);
    expect(coverApForToken({ document: {} })).toBe(0);
    expect(coverApForToken(null)).toBe(0);
  });

  it("одна зона Укрытия — её coverAp", () => {
    const region = { behaviors: [behavior({ coverAp: 6 })] };
    expect(coverApForToken(tokenIn([region]))).toBe(6);
  });

  it("несколько зон — берётся наибольший AP", () => {
    const r1 = { behaviors: [behavior({ coverAp: 4 })] };
    const r2 = { behaviors: [behavior({ coverAp: 8 })] };
    expect(coverApForToken(tokenIn([r1, r2]))).toBe(8);
  });

  it("отключённый behavior (disabled) не считается", () => {
    const region = { behaviors: [behavior({ coverAp: 8, disabled: true })] };
    expect(coverApForToken(tokenIn([region]))).toBe(0);
  });

  it("behavior другого типа игнорируется", () => {
    const region = { behaviors: [behavior({ type: "difficultTerrain", coverAp: 8 })] };
    expect(coverApForToken(tokenIn([region]))).toBe(0);
  });
});

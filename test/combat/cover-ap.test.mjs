// test/combat/cover-ap.test.mjs
//
// coverApForToken (wdbc-9wvm, «Отскок в Укрытие», стр. 12) — AP зоны
// Укрытия, в которой СЕЙЧАС стоит токен, без проверки линии огня (в отличие
// от coverBonusForShot — тот штрафует ПОРОГ атаки ДО Уклонения и поэтому
// обязан знать стрелка; здесь игрок уже объявил «отскочил сюда сам»).

import { describe, it, expect } from "vitest";
import "../support/foundry-stub.mjs";
import { coverApForToken, coverRegionForShot } from "../../module/combat/cover.mjs";
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

// «Разрушение Укрытий» (решение Сергея 24.09.2026): зона на сцене даёт AP
// обычному стрелковому урону и изнашивается — но только если линия огня её
// пересекает (стрелок за той же стеной — не прикрывает).
describe("coverRegionForShot", () => {
  const shooter = { center: { x: 0, y: 0 } };
  const target = regions => ({ center: { x: 100, y: 0 }, document: { regions: new Set(regions), elevation: 0 } });
  const wall = (ap, hit) => ({ behaviors: [behavior({ coverAp: ap })], testPoint: () => hit });

  it("зона на линии огня — её AP и сам behavior (чтобы изнашивать)", () => {
    const r = wall(6, true);
    const found = coverRegionForShot(shooter, target([r]));
    expect(found.ap).toBe(6);
    expect(found.behavior).toBe(r.behaviors[0]);
  });

  it("линия огня зону не пересекает — не прикрывает", () => {
    expect(coverRegionForShot(shooter, target([wall(6, false)]))).toBeNull();
  });

  it("несколько зон на линии — наибольший AP", () => {
    expect(coverRegionForShot(shooter, target([wall(4, true), wall(9, true)])).ap).toBe(9);
  });
});

describe("coverRegionForShot: документ токена вместо самого токена", () => {
  it("TokenDocument стрелка (как отдаёт resolveAttackerToken) — берётся его object", () => {
    const shooterDoc = { object: { center: { x: 0, y: 0 } } };
    const region = { behaviors: [behavior({ coverAp: 6 })], testPoint: () => true };
    const target = { center: { x: 100, y: 0 }, document: { regions: new Set([region]), elevation: 0 } };
    expect(coverRegionForShot(shooterDoc, target)?.ap).toBe(6);
  });
});

// test/rules/breath-of-life.test.mjs
//
// Дыхание Жизни / Breath of Life (Дар Нургла, wdbc-1rno): свои Раны в 0,
// труп встаёт с 0; повтор только после полного излечения.

import { describe, it, expect } from "vitest";
import {
  isBreathOfLifeItem, woundsFullyHealed, breathOfLifeAvailable,
  breathOfLifeSelfWounds, revivedCorpseUpdate, BREATH_OF_LIFE
} from "../../module/rules/breath-of-life.mjs";

const sys = (value, max = 12, critical = 0) => ({ wounds: { value, max, critical } });

function giftItem({ type = "mutation", key = BREATH_OF_LIFE, name = "Х" } = {}) {
  return {
    type, name,
    flags: { "warhammer-dbc": { mechanics: key
      ? [{ id: "g", operator: "AND", entries: [{ id: "e", kind: "capability", capabilityKey: key }] }]
      : [] } }
  };
}

describe("isBreathOfLifeItem", () => {
  it("опознаёт по ключу Возможности", () => {
    expect(isBreathOfLifeItem(giftItem())).toBe(true);
  });
  it("опознаёт по билингвальному имени без записи Механики", () => {
    expect(isBreathOfLifeItem(giftItem({ key: null, name: "Breath of Life / Дыхание Жизни" }))).toBe(true);
  });
  it("тот же ключ на предмете другого типа — не он", () => {
    expect(isBreathOfLifeItem(giftItem({ type: "talent" }))).toBe(false);
  });
});

describe("woundsFullyHealed", () => {
  it("Раны на максимуме без отрицательных — вылечен", () => {
    expect(woundsFullyHealed(sys(12))).toBe(true);
  });
  it("максимум есть, но отрицательные Раны висят — не вылечен", () => {
    expect(woundsFullyHealed(sys(12, 12, 3))).toBe(false);
  });
  it("Ран меньше максимума — не вылечен", () => {
    expect(woundsFullyHealed(sys(11))).toBe(false);
  });
  it("effectiveMax (Саркофаг Дредноута) важнее хранимого max", () => {
    expect(woundsFullyHealed({ wounds: { value: 7, max: 12, effectiveMax: 7, critical: 0 } })).toBe(true);
  });
});

describe("breathOfLifeAvailable", () => {
  it("ещё не использован — доступен при любых Ранах", () => {
    expect(breathOfLifeAvailable(sys(1), false)).toBe(true);
  });
  it("использован и Раны не полны — заперт", () => {
    expect(breathOfLifeAvailable(sys(11), true)).toBe(false);
  });
  it("использован, но Раны вылечены целиком — снова доступен", () => {
    expect(breathOfLifeAvailable(sys(12), true)).toBe(true);
  });
});

describe("breathOfLifeSelfWounds", () => {
  it("Раны выше нуля — уходят в ноль", () => {
    expect(breathOfLifeSelfWounds(sys(9))).toBe(0);
  });
  it("Раны уже на нуле — цена не берётся («если они не были ниже»)", () => {
    expect(breathOfLifeSelfWounds(sys(0))).toBe(null);
  });
  it("отрицательные Раны не поднимаются до нуля", () => {
    expect(breathOfLifeSelfWounds({ wounds: { value: 0, max: 12, critical: 5 } })).toBe(null);
  });
});

describe("revivedCorpseUpdate", () => {
  it("труп встаёт с 0 Ран и без отрицательных", () => {
    expect(revivedCorpseUpdate()).toEqual({
      "system.wounds.value": 0, "system.wounds.critical": 0
    });
  });
});

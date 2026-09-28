// test/rules/splice-adaptations.test.mjs
//
// Сплайс (Основная книга, «Отродия → Сплайс»):
//  «Gene-Splice: Сплайс выбирает по одной адаптации из трех списков далее. Он
//   может выбрать дополнительные адаптации (из основных списков или
//   продвинутые), теряя +5% опыта от Трейта Fast Learner за каждую (максимум
//   +3 дополнительные адаптации).»
//  «Unstable Genome: Каждый раз, когда Сплайс получает урон в Характеристики,
//   он увеличивает этот урон на +1 и еще на +1 за каждую дополнительную
//   адаптацию.»

import { describe, it, expect } from "vitest";
import {
  SPLICE_ADAPTATION_FLAG, isSpliceAdaptation, spliceAdaptationCount, spliceExtraAdaptations,
  fastLearnerWithAdaptations, unstableGenomeBonus
} from "../../module/rules/splice-adaptations.mjs";

const adapt = (kind, name = `Adaptation: ${kind}`) =>
  ({ type: "trait", name, flags: { "warhammer-dbc": { [SPLICE_ADAPTATION_FLAG]: kind } } });
const trait = name => ({ type: "trait", name, flags: {} });
const actor = items => ({ items });
const GENOME = trait("Unstable Genome / Нестабильный Геном");

describe("Адаптации Сплайса — подсчёт", () => {
  it("адаптацию опознаёт метка, а не имя", () => {
    expect(isSpliceAdaptation(adapt("sensory"))).toBe(true);
    expect(isSpliceAdaptation(trait("Amphibious / Амфибия"))).toBe(false);
    expect(isSpliceAdaptation({ type: "talent", flags: { "warhammer-dbc": { [SPLICE_ADAPTATION_FLAG]: "sensory" } } })).toBe(false);
  });

  it("три обязательные — не дополнительные", () => {
    const a = actor([adapt("sensory"), adapt("defensive"), adapt("offensive")]);
    expect(spliceAdaptationCount(a)).toBe(3);
    expect(spliceExtraAdaptations(a)).toBe(0);
  });

  it("каждая сверх трёх — дополнительная, не больше трёх", () => {
    const base = [adapt("sensory"), adapt("defensive"), adapt("offensive")];
    expect(spliceExtraAdaptations(actor([...base, adapt("advanced")]))).toBe(1);
    expect(spliceExtraAdaptations(actor([...base, adapt("advanced"), adapt("sensory"), adapt("advanced")]))).toBe(3);
    expect(spliceExtraAdaptations(actor([...base, ...Array(5).fill(adapt("advanced"))]))).toBe(3);
  });

  it("недобор обязательных не даёт отрицательных дополнительных", () => {
    expect(spliceExtraAdaptations(actor([adapt("sensory")]))).toBe(0);
    expect(spliceExtraAdaptations(actor([]))).toBe(0);
    expect(spliceExtraAdaptations(null)).toBe(0);
  });
});

describe("Ловит на Лету: −5% за каждую дополнительную адаптацию", () => {
  it("15 → 10 → 5 → 0", () => {
    expect(fastLearnerWithAdaptations(15, 0)).toBe(15);
    expect(fastLearnerWithAdaptations(15, 1)).toBe(10);
    expect(fastLearnerWithAdaptations(15, 2)).toBe(5);
    expect(fastLearnerWithAdaptations(15, 3)).toBe(0);
  });
  it("ниже нуля не уходит", () => {
    expect(fastLearnerWithAdaptations(10, 3)).toBe(0);
  });
});

describe("Нестабильный Геном: +1 и ещё +1 за каждую дополнительную", () => {
  const base = [GENOME, adapt("sensory"), adapt("defensive"), adapt("offensive")];
  it("без дополнительных — +1", () => {
    expect(unstableGenomeBonus(actor(base))).toBe(1);
  });
  it("с двумя дополнительными — +3", () => {
    expect(unstableGenomeBonus(actor([...base, adapt("advanced"), adapt("advanced")]))).toBe(3);
  });
  it("без Черты — ничего, даже с адаптациями", () => {
    expect(unstableGenomeBonus(actor(base.slice(1)))).toBe(0);
  });
  it("Черта опознаётся по любой половине имени", () => {
    expect(unstableGenomeBonus(actor([trait("Нестабильный Геном")]))).toBe(1);
  });
});

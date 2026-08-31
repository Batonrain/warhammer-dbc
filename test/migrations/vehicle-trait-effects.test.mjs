// test/migrations/vehicle-trait-effects.test.mjs
//
// Чистая часть догоняющего прохода Черт техники (wdbc-y33b): добавляются
// только ОТСУТСТВУЮЩИЕ ключи effects, существующие значения не трогаются,
// двуязычное имя пака матчится и целиком, и половинами.

import { describe, it, expect } from "vitest";
import { missingEffectKeys, matchTraitDoc } from "../../module/migrations/vehicle-trait-effects.mjs";

describe("missingEffectKeys", () => {
  it("добавляет только отсутствующие ключи, существующие значения не трогает", () => {
    const canon   = { amphibious: false, sideHatches: false, spdMod: 0 };
    const current = { spdMod: -2 };
    expect(missingEffectKeys(canon, current)).toEqual({ amphibious: false, sideHatches: false });
  });

  it("всё уже на месте — пустой патч (идемпотентность)", () => {
    const canon = { amphibious: false };
    expect(missingEffectKeys(canon, { amphibious: true })).toEqual({});
  });
});

describe("matchTraitDoc", () => {
  const docs = [{ name: "Side Hatches / Боковые Двери", system: { effects: { sideHatches: false } } }];
  it("матчится целиком и любой половиной двуязычного имени", () => {
    expect(matchTraitDoc("Side Hatches / Боковые Двери", docs)).toBe(docs[0]);
    expect(matchTraitDoc("Боковые Двери", docs)).toBe(docs[0]);
    expect(matchTraitDoc("side hatches", docs)).toBe(docs[0]);
  });
  it("незнакомое имя — null, Черта не трогается", () => {
    expect(matchTraitDoc("Неизвестная", docs)).toBeNull();
  });

  it("рейтинг копии «(4)» матчится с шаблоном «(X)» канона", () => {
    const rated = [{ name: "Демонический (X) / Daemonic (X)", system: { effects: { daemonicAbsorb: true } } }];
    expect(matchTraitDoc("Демонический (4)", rated)).toBe(rated[0]);
    expect(matchTraitDoc("Daemonic (4)", rated)).toBe(rated[0]);
  });
});

describe("смена семантики spdDamageReduce (число → флаг)", () => {
  it("falsy 0 на копии перезаписывается каноном, truthy правка ГМа — нет", () => {
    expect(missingEffectKeys({ spdDamageReduce: true }, { spdDamageReduce: 0 })).toEqual({ spdDamageReduce: true });
    expect(missingEffectKeys({ spdDamageReduce: true }, { spdDamageReduce: true })).toEqual({});
  });
});

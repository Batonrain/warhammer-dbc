// Эффекты заключения в саркофаг (Книга Машин, стр. 57). Тринадцать пунктов
// книги, из которых считаются семь числовых; остальные — иммунитеты и
// возможности, они раздаются именами.

import { describe, it, expect } from "vitest";
import {
  SARCOPHAGUS, sarcophagusCharDelta, sarcophagusFlags, sarcophagusWarpWounds
} from "../../module/rules/dreadnought.mjs";

describe("числовые правки пилота", () => {
  it("Unnatural S −4, Unnatural T −2, максимум Ран −5 — как в книге", () => {
    expect(SARCOPHAGUS.unnaturalS).toBe(-4);
    expect(SARCOPHAGUS.unnaturalT).toBe(-2);
    expect(SARCOPHAGUS.woundsMax).toBe(-5);
  });

  it("Unnatural W +4 и +30 против воздействий на сознание", () => {
    expect(SARCOPHAGUS.unnaturalW).toBe(4);
    expect(SARCOPHAGUS.mindControlBonus).toBe(30);
  });

  it("саркофаг — Машина с AP 30 и 10 Структуры", () => {
    expect(SARCOPHAGUS.armour).toBe(30);
    expect(SARCOPHAGUS.structure).toBe(10);
  });

  it("+30 к тестам против ядов", () => {
    expect(SARCOPHAGUS.poisonBonus).toBe(30);
  });
});

describe("sarcophagusCharDelta: снижение рейтингов Сверхъестественного", () => {
  it("уменьшает, но не уводит рейтинг ниже нуля", () => {
    expect(sarcophagusCharDelta({ s: 6, t: 5 })).toEqual({ s: -4, t: -2, wp: 4 });
    // У пилота без Сверхъестественной Силы отнимать нечего: −4 от нуля дало бы
    // отрицательный рейтинг, которого в книге не бывает.
    expect(sarcophagusCharDelta({ s: 2, t: 1 })).toEqual({ s: -2, t: -1, wp: 4 });
    expect(sarcophagusCharDelta({})).toEqual({ s: 0, t: 0, wp: 4 });
  });
});

describe("аблативные Раны против варп-оружия", () => {
  it("равны бонусу Воли и восстанавливаются к концу боя", () => {
    expect(sarcophagusWarpWounds(5)).toBe(5);
    expect(sarcophagusWarpWounds(0)).toBe(0);
  });

  it("отрицательный бонус Воли не даёт отрицательных Ран", () => {
    expect(sarcophagusWarpWounds(-2)).toBe(0);
  });
});

describe("возможности саркофага", () => {
  const flags = sarcophagusFlags();

  it("иммунитеты и автоуспехи книги раздаются именами", () => {
    expect(flags).toContain("sarcophagus.autoPassFear");
    expect(flags).toContain("sarcophagus.immuneBleedingFatigue");
    expect(flags).toContain("sarcophagus.noPsychicPowers");
    expect(flags).toContain("sarcophagus.helpless");
  });

  it("все имена значатся в реестре возможностей", async () => {
    const { isKnownCapability } = await import("../../module/constants/capabilities.mjs");
    const unknown = flags.filter(f => !isKnownCapability(f));
    expect(unknown).toEqual([]);
  });
});

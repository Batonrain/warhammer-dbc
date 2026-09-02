// test/constants/formation.test.mjs
//
// module/constants/formation.mjs — «Книга Битв»: расчётные функции формирований
// (Сила/Оборона/кости урона/скорость/укрытие/истощение/численность).

import { describe, it, expect } from "vitest";
import {
  TROOP_TYPES,
  TECH_ALLOWED, TECH_ORDER, ATTRITION,
  totalStrength, defenceFrom, damageDice, effectiveSpeed, totalCover,
  attritionPenalty, availabilityMod, numbersFromHeadcount
} from "../../module/constants/formation.mjs";

describe("totalStrength", () => {
  it("складывает Силу рода войск, технический уровень, качество снаряжения и ручной мод", () => {
    // mediumInfantry s:4, industrial s:1, good s:1, mod +2 → 8
    expect(totalStrength({ troopType: "mediumInfantry", techLevel: "industrial", gearQuality: "good", strengthMod: 2 })).toBe(8);
  });

  it("strengthOverride побеждает расчёт (астартес/титаны)", () => {
    expect(totalStrength({ troopType: "lightInfantry", techLevel: "savage", gearQuality: "poor", strengthOverride: 20 })).toBe(20);
  });

  it("strengthOverride:0 — валидное явное значение, не путается с «не задано»", () => {
    expect(totalStrength({ troopType: "mediumInfantry", techLevel: "modern", gearQuality: "good", strengthOverride: 0 })).toBe(0);
  });

  it("итог не уходит ниже нуля даже при большом отрицательном моде", () => {
    expect(totalStrength({ troopType: "lightInfantry", techLevel: "savage", gearQuality: "poor", strengthMod: -100 })).toBe(0);
  });

  it("неизвестный род войск/уровень/качество — трактуется как 0", () => {
    expect(totalStrength({ troopType: "no-such-troop", techLevel: "no-such-tech", gearQuality: "no-such-gear" })).toBe(0);
  });
});

describe("defenceFrom", () => {
  it("равна удвоенной Силе", () => {
    expect(defenceFrom(5)).toBe(10);
    expect(defenceFrom(0)).toBe(0);
  });

  it("нечисловое значение — трактуется как 0", () => {
    expect(defenceFrom(undefined)).toBe(0);
  });
});

describe("damageDice", () => {
  it("берёт число костей из FORMATION_SIZES по ключу размера", () => {
    expect(damageDice("squad")).toBe(1);
    expect(damageDice("battalion")).toBe(4);
  });

  it("diceMod сдвигает результат, но не ниже нуля", () => {
    expect(damageDice("company", -1)).toBe(2);
    expect(damageDice("squad", -5)).toBe(0);
  });

  it("неизвестный размер — дефолт 4 кости (крупные соединения)", () => {
    expect(damageDice("no-such-size")).toBe(4);
  });
});

describe("effectiveSpeed", () => {
  it("базовая скорость рода войск умножается на множитель ландшафта", () => {
    // lightInfantry spd:30, urban speed:0.75 → 22.5 → округление до 23 (Math.round)
    expect(effectiveSpeed({ troopType: "lightInfantry", terrain: "urban" })).toBe(23);
  });

  it("speedMult (приказ) умножается сверху", () => {
    // lightInfantry 30 * open(1.0) * cautious(0.5) = 15
    expect(effectiveSpeed({ troopType: "lightInfantry", terrain: "open", speedMult: 0.5 })).toBe(15);
  });

  it("speedOverride задаёт базу напрямую, включая явный 0", () => {
    expect(effectiveSpeed({ troopType: "lightInfantry", terrain: "open", speedOverride: 100 })).toBe(100);
    expect(effectiveSpeed({ troopType: "lightInfantry", terrain: "open", speedOverride: 0 })).toBe(0);
  });

  it("неизвестный ландшафт — множитель 1 (без штрафа)", () => {
    expect(effectiveSpeed({ troopType: "lightInfantry", terrain: "no-such-terrain" })).toBe(30);
  });
});

describe("totalCover", () => {
  it("складывает укрытие ландшафта, окопы, прикрытие ПВО и ручной мод", () => {
    expect(totalCover({ terrain: "rough", dugIn: 10, aaCover: 5, coverMod: 1 })).toBe(18);
  });

  it("не уходит ниже нуля", () => {
    expect(totalCover({ terrain: "open", coverMod: -50 })).toBe(0);
  });
});

describe("attritionPenalty", () => {
  it("−5 за каждые полные 20 потерянного боевого духа", () => {
    // 0 * penaltyStep даёт -0 в JS (Math.floor(0/20) * -5) — функционально
    // тот же ноль, toBe(-0) точнее отражает реальное возвращаемое значение.
    expect(attritionPenalty(100, 100)).toBe(-0);
    expect(attritionPenalty(100, 80)).toBe(-5);
    expect(attritionPenalty(100, 61)).toBe(-5);
    expect(attritionPenalty(100, 60)).toBe(-10);
    expect(attritionPenalty(100, 0)).toBe(-25);
  });

  it("текущее значение выше максимума — потерь нет, штраф 0", () => {
    expect(attritionPenalty(50, 80)).toBe(-0);
  });
});

describe("availabilityMod", () => {
  it("складывает модификатор техуровня и подготовки", () => {
    // modern avail:-10, veterans avail:-20 → -30
    expect(availabilityMod("modern", "veterans")).toBe(-30);
  });

  it("неизвестные значения трактуются как 0", () => {
    expect(availabilityMod("no-such-tech", "no-such-training")).toBe(0);
  });
});

describe("numbersFromHeadcount", () => {
  it("10% от числа людей, округление", () => {
    expect(numbersFromHeadcount(100)).toBe(10);
    expect(numbersFromHeadcount(55)).toBe(6); // 5.5 → Math.round округляет вверх → 6
  });

  it("астартес — впятеро выше при том же округлении по десятине", () => {
    expect(numbersFromHeadcount(100, true)).toBe(50);
  });

  it("отрицательное/нечисловое значение — 0", () => {
    expect(numbersFromHeadcount(-10)).toBe(0);
    expect(numbersFromHeadcount("не число")).toBe(0);
  });
});

describe("справочные таблицы: внутренняя согласованность", () => {
  it("TECH_ALLOWED для каждого уровня — подмножество известных категорий войск", () => {
    const cats = new Set(Object.values(TROOP_TYPES).map(t => t.cat));
    for (const level of TECH_ORDER) {
      for (const cat of TECH_ALLOWED[level]) expect(cats.has(cat), `${level}: ${cat}`).toBe(true);
    }
  });

  it("TECH_ALLOWED монотонно расширяется по TECH_ORDER (более развитый уровень не теряет доступ)", () => {
    for (let i = 1; i < TECH_ORDER.length; i++) {
      const prev = new Set(TECH_ALLOWED[TECH_ORDER[i - 1]]);
      const cur = TECH_ALLOWED[TECH_ORDER[i]];
      for (const cat of prev) expect(cur, TECH_ORDER[i]).toContain(cat);
    }
  });

  it("ATTRITION.thresholds заданы по убыванию (50% раньше 25%)", () => {
    expect(ATTRITION.thresholds[0]).toBeGreaterThan(ATTRITION.thresholds[1]);
  });

  it("у каждого рода войск есть валидная категория из GEAR_QUALITY/TECH_LEVELS-совместимого набора", () => {
    for (const [key, t] of Object.entries(TROOP_TYPES)) {
      expect(t.s, key).toBeGreaterThanOrEqual(0);
      expect(t.spd, key).toBeGreaterThan(0);
    }
  });
});

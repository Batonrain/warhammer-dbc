// test/constants/ship-corruption.test.mjs
//
// module/constants/ship-corruption.mjs — Осквернение кораблей (Defilement
// Points): пороги 10/30/50/70/90, таблица искажений 1d100 + субмутации.

import { describe, it, expect } from "vitest";
import {
  SHIP_DEFILEMENT_THRESHOLDS, DAEMON_SHIP_DP, SHIP_DISTORTIONS,
  crossedThresholds, findDistortion, findSubmutation
} from "../../module/constants/ship-corruption.mjs";

describe("crossedThresholds", () => {
  it("ниже первого порога — ни одного искажения", () => {
    expect(crossedThresholds(9)).toEqual([]);
  });

  it("ровно на пороге — считается пересечённым (>=)", () => {
    expect(crossedThresholds(10)).toHaveLength(1);
    expect(crossedThresholds(10)[0].level).toBe(1);
  });

  it("между порогами — все пройденные, не только ближайший", () => {
    const crossed = crossedThresholds(55);
    expect(crossed.map(t => t.level)).toEqual([1, 2, 3]);
  });

  it("на DAEMON_SHIP_DP — пройдены все пять", () => {
    expect(crossedThresholds(DAEMON_SHIP_DP)).toHaveLength(SHIP_DEFILEMENT_THRESHOLDS.length);
  });

  it("нечисловое/отсутствующее значение — трактуется как 0", () => {
    expect(crossedThresholds(undefined)).toEqual([]);
    expect(crossedThresholds("не число")).toEqual([]);
  });
});

describe("SHIP_DEFILEMENT_THRESHOLDS", () => {
  it("модификатор реверсируется по мере роста порога: от −40 до +40", () => {
    expect(SHIP_DEFILEMENT_THRESHOLDS[0].mod).toBe(-40);
    expect(SHIP_DEFILEMENT_THRESHOLDS.at(-1).mod).toBe(40);
    for (let i = 1; i < SHIP_DEFILEMENT_THRESHOLDS.length; i++) {
      expect(SHIP_DEFILEMENT_THRESHOLDS[i].mod).toBeGreaterThan(SHIP_DEFILEMENT_THRESHOLDS[i - 1].mod);
    }
  });
});

describe("SHIP_DISTORTIONS", () => {
  it("покрывает диапазон 1..100 без дыр и наложений", () => {
    const sorted = [...SHIP_DISTORTIONS].sort((a, b) => a.min - b.min);
    expect(sorted[0].min).toBe(1);
    expect(sorted.at(-1).max).toBe(100);
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i].min).toBe(sorted[i - 1].max + 1);
    }
  });

  it("названия строк уникальны", () => {
    const names = SHIP_DISTORTIONS.map(d => d.name);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe("findDistortion", () => {
  it("находит строку по каждой границе диапазона (min и max)", () => {
    for (const d of SHIP_DISTORTIONS) {
      expect(findDistortion(d.min)).toBe(d);
      expect(findDistortion(d.max)).toBe(d);
    }
  });

  it("клампит выход за 1..100 (0 → 1, >100 → 100)", () => {
    expect(findDistortion(0)).toBe(findDistortion(1));
    expect(findDistortion(500)).toBe(findDistortion(100));
  });
});

describe("findSubmutation", () => {
  it("без таблицы субмутации — null", () => {
    expect(findSubmutation(null, 5)).toBeNull();
  });

  it("находит субмутацию по броску, нечисловой бросок трактуется как 1", () => {
    const mocker = SHIP_DISTORTIONS.find(d => d.name === "Пересмешник").submut;
    expect(findSubmutation(mocker, 1).name).toBe("Пустой");
    expect(findSubmutation(mocker, "не число").name).toBe("Пустой");
    expect(findSubmutation(mocker, 10).name).toBe("Похититель");
  });

  it("у каждой встроенной таблицы субмутаций диапазон 1..10 без дыр", () => {
    const withSubmut = SHIP_DISTORTIONS.filter(d => d.submut);
    expect(withSubmut.length).toBeGreaterThan(0);
    for (const d of withSubmut) {
      const sorted = [...d.submut.table].sort((a, b) => a.min - b.min);
      expect(sorted[0].min, d.name).toBe(1);
      expect(sorted.at(-1).max, d.name).toBe(10);
      for (let i = 1; i < sorted.length; i++) {
        expect(sorted[i].min, d.name).toBe(sorted[i - 1].max + 1);
      }
    }
  });
});

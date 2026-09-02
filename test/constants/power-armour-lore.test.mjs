// test/constants/power-armour-lore.test.mjs
//
// module/constants/power-armour-lore.mjs — «Силовая броня: без шлема и
// особенности» (три таблицы к10 + допустимые сдвиги результата).

import { describe, it, expect } from "vitest";
import {
  PA_TABLES, PA_TABLE_ORDER, PA_TABLE_PICK, PA_ZONES,
  entryByRoll, rangeLabel, shiftOptions
} from "../../module/constants/power-armour-lore.mjs";

describe("PA_TABLES", () => {
  it("каждая из трёх таблиц покрывает 1..10 без дыр и наложений", () => {
    for (const key of PA_TABLE_ORDER) {
      const sorted = [...PA_TABLES[key].entries].sort((a, b) => a.min - b.min);
      expect(sorted[0].min, key).toBe(1);
      expect(sorted.at(-1).max, key).toBe(10);
      for (let i = 1; i < sorted.length; i++) {
        expect(sorted[i].min, key).toBe(sorted[i - 1].max + 1);
      }
    }
  });

  it("названия строк внутри каждой таблицы уникальны", () => {
    for (const key of PA_TABLE_ORDER) {
      const names = PA_TABLES[key].entries.map(e => e.name);
      expect(new Set(names).size, key).toBe(names.length);
    }
  });
});

describe("entryByRoll", () => {
  it("находит запись по каждой границе диапазона в каждой таблице", () => {
    for (const key of PA_TABLE_ORDER) {
      for (const e of PA_TABLES[key].entries) {
        expect(entryByRoll(key, e.min)).toBe(e);
        expect(entryByRoll(key, e.max)).toBe(e);
      }
    }
  });

  it("неизвестная таблица — null", () => {
    expect(entryByRoll("no-such-table", 1)).toBeNull();
  });

  it("клампит бросок в 1..10", () => {
    expect(entryByRoll("history", 0)).toBe(entryByRoll("history", 1));
    expect(entryByRoll("history", 99)).toBe(entryByRoll("history", 10));
  });
});

describe("rangeLabel", () => {
  it("одиночное значение — просто число", () => {
    expect(rangeLabel({ min: 5, max: 5 })).toBe("5");
  });

  it("диапазон — через дефис", () => {
    expect(rangeLabel({ min: 3, max: 4 })).toBe("3-4");
  });
});

describe("shiftOptions", () => {
  it("без Inf.b — доступен только сам результат (плюс книжный обмен 1↔2/10 и 10↔9/1)", () => {
    expect(shiftOptions(5, 0)).toEqual([5]);
  });

  it("Inf.b 2 даёт сдвиг на ½Inf.b (окр.▲) = 1 в обе стороны", () => {
    expect(shiftOptions(5, 2)).toEqual([4, 5, 6]);
  });

  it("Inf.b 3 округляется вверх до сдвига 2", () => {
    expect(shiftOptions(5, 3)).toEqual([3, 4, 5, 6, 7]);
  });

  it("сдвиг не выходит за границы 1..10", () => {
    expect(shiftOptions(1, 4)).toEqual([1, 2, 3, 10]);
    expect(shiftOptions(10, 4)).toEqual([1, 8, 9, 10]);
  });

  it("особый обмен: выпавшая 1 всегда предлагает 2 и 10, выпавшая 10 — 9 и 1", () => {
    expect(shiftOptions(1, 0)).toEqual([1, 2, 10]);
    expect(shiftOptions(10, 0)).toEqual([1, 9, 10]);
  });
});

describe("PA_TABLE_PICK / PA_ZONES", () => {
  it("выбор таблицы — 5 строк на к5, значения table ссылаются на реальные таблицы или спецрежим", () => {
    expect(PA_TABLE_PICK).toHaveLength(5);
    const specials = new Set(["any", "two"]);
    for (const p of PA_TABLE_PICK) {
      expect(PA_TABLE_ORDER.includes(p.table) || specials.has(p.table), p.table).toBe(true);
    }
  });

  it("ровно 6 зон, ключи уникальны", () => {
    expect(PA_ZONES).toHaveLength(6);
    expect(new Set(PA_ZONES.map(z => z.key)).size).toBe(6);
  });
});

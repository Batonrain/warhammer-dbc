// test/rules/carry-weight.test.mjs
//
// Таблица Максимального Веса (стр. 27): Ношение, Подъём и Толкание по сумме
// S.b + T.b. Раньше в коде лежал один столбец, а Подъём и Толкание выводились
// сдвигом строки на +1 и +2. Сходится это только у слабых персонажей: уже при
// сумме 4 книга даёт Подъём 36, а строка 5 — 27. В самом столбце Ношения
// хвост тоже разошёлся: с суммы 43 там стояли числа Подъёма.

import { describe, it, expect } from "vitest";
import { carryRow, _calcMaxCarry } from "../../module/helpers/utils.mjs";

describe("таблица Максимального Веса", () => {
  it("строки книги воспроизводятся целиком", () => {
    expect(carryRow(0)).toEqual({ carry: 0.9, lift: 2.25, push: 4.5 });
    expect(carryRow(4)).toEqual({ carry: 18, lift: 36, push: 72 });
    expect(carryRow(10)).toEqual({ carry: 78, lift: 156, push: 312 });
    expect(carryRow(20)).toEqual({ carry: 2250, lift: 4500, push: 9000 });
  });

  it("Астартес (S.b 8 + T.b 8) носит 675, поднимает 1350, двигает 2700", () => {
    expect(carryRow(16)).toEqual({ carry: 675, lift: 1350, push: 2700 });
  });

  it("хвост таблицы взят из столбца Ношения, а не Подъёма", () => {
    expect(carryRow(43).carry).toBe(80000);    // было 84 000
    expect(carryRow(44).carry).toBe(92000);    // было 106 000
    expect(carryRow(45).carry).toBe(106000);   // было 212 000
  });

  it("за краями таблицы берутся крайние строки", () => {
    expect(carryRow(-5)).toEqual(carryRow(0));
    expect(carryRow(999)).toEqual(carryRow(45));
  });

  it("_calcMaxCarry — это столбец Ношения", () => {
    expect(_calcMaxCarry(16)).toBe(675);
    expect(_calcMaxCarry(0)).toBe(0.9);
  });

  it("Подъём вдвое, Толкание вчетверо от Ношения — там, где так в книге", () => {
    for (const idx of [5, 6, 7, 8, 14, 16, 20, 30, 45]) {
      const row = carryRow(idx);
      expect(row.lift).toBe(row.carry * 2);
      expect(row.push).toBe(row.carry * 4);
    }
  });
});

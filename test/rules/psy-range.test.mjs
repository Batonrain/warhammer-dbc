import { describe, it, expect } from "vitest";
import { parseRangeMeters, rangeVerdict } from "../../module/rules/psy-range.mjs";

describe("parseRangeMeters: текст поля range → метры|null", () => {
  it("простое число с «м»", () => {
    expect(parseRangeMeters("30м")).toBe(30);
    expect(parseRangeMeters("20м")).toBe(20);
  });

  it("декоративный суффикс «(Аура)» не мешает", () => {
    expect(parseRangeMeters("30м (Аура)")).toBe(30);
  });

  it("PR×N — умножает на переданный тPR", () => {
    expect(parseRangeMeters("PR×10м", 3)).toBe(30);
    expect(parseRangeMeters("PR×0,5м", 4)).toBe(2);
    expect(parseRangeMeters("PR×0.5м", 4)).toBe(2);
  });

  it("километры переводятся в метры", () => {
    expect(parseRangeMeters("PR×1км", 2)).toBe(2000);
    expect(parseRangeMeters("PR×200км", 1)).toBe(200000);
  });

  it("PR×N без тPR (по умолчанию 0) даёт 0, а не NaN", () => {
    expect(parseRangeMeters("PR×10м")).toBe(0);
  });

  it("составные дальности через «/» — не разбираются", () => {
    expect(parseRangeMeters("Касание / PR×10м", 3)).toBeNull();
    expect(parseRangeMeters("PR×5/20/50м (Аура)", 3)).toBeNull();
  });

  it("текстовые дальности — null", () => {
    expect(parseRangeMeters("Касание")).toBeNull();
    expect(parseRangeMeters("Сам")).toBeNull();
    expect(parseRangeMeters("Особая")).toBeNull();
    expect(parseRangeMeters("Неогранич.")).toBeNull();
    expect(parseRangeMeters("В системе")).toBeNull();
    expect(parseRangeMeters("Ближний бой")).toBeNull();
  });

  it("пусто/undefined — null", () => {
    expect(parseRangeMeters("")).toBeNull();
    expect(parseRangeMeters(undefined)).toBeNull();
    expect(parseRangeMeters(null)).toBeNull();
  });
});

describe("rangeVerdict: измеренная дистанция vs дальность силы", () => {
  it("в пределах — edgeM <= rangeMeters", () => {
    expect(rangeVerdict(24, 30)).toEqual({ inBounds: true, edgeM: 24, rangeMeters: 30 });
    expect(rangeVerdict(30, 30)).toEqual({ inBounds: true, edgeM: 30, rangeMeters: 30 });
  });

  it("вне — edgeM > rangeMeters", () => {
    expect(rangeVerdict(31, 30)).toEqual({ inBounds: false, edgeM: 31, rangeMeters: 30 });
  });

  it("null при отсутствии числовых данных", () => {
    expect(rangeVerdict(null, 30)).toBeNull();
    expect(rangeVerdict(24, null)).toBeNull();
    expect(rangeVerdict(NaN, 30)).toBeNull();
  });
});

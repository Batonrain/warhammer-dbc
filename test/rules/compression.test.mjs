// test/rules/compression.test.mjs
//
// module/rules/compression.mjs (wdbc-1rno, мутация «Compression/Сжатие») —
// чистые функции состояния втянутых частей тела, без Foundry-зависимостей.

import { describe, it, expect } from "vitest";
import {
  COMPRESSIBLE_LOCATIONS, isCompressibleLocation, retractPart, extendPart,
  isPartCompressed, hasCompressedHead, allLimbsCompressed
} from "../../module/rules/compression.mjs";

describe("isCompressibleLocation", () => {
  it("Торс нельзя втянуть — он и есть место, куда всё втягивается", () => {
    expect(isCompressibleLocation("Торс")).toBe(false);
  });
  it("Голова/руки/ноги — можно", () => {
    for (const loc of COMPRESSIBLE_LOCATIONS) expect(isCompressibleLocation(loc)).toBe(true);
  });
});

describe("retractPart / extendPart", () => {
  it("добавляет часть тела в пустой список", () => {
    expect(retractPart([], "Голова")).toEqual(["Голова"]);
  });
  it("не дублирует уже втянутую часть", () => {
    expect(retractPart(["Голова"], "Голова")).toEqual(["Голова"]);
  });
  it("Торс не добавляется (не входит в COMPRESSIBLE_LOCATIONS)", () => {
    expect(retractPart([], "Торс")).toEqual([]);
  });
  it("extendPart убирает ровно одну часть, остальные не трогает", () => {
    expect(extendPart(["Голова", "П. Рука"], "Голова")).toEqual(["П. Рука"]);
  });
  it("extendPart на отсутствующей части — no-op", () => {
    expect(extendPart(["Голова"], "Л. Нога")).toEqual(["Голова"]);
  });
  it("undefined-список не роняет функции", () => {
    expect(retractPart(undefined, "Голова")).toEqual(["Голова"]);
    expect(extendPart(undefined, "Голова")).toEqual([]);
  });
});

describe("isPartCompressed / hasCompressedHead", () => {
  it("отражает текущий список", () => {
    expect(isPartCompressed(["Голова"], "Голова")).toBe(true);
    expect(isPartCompressed(["Голова"], "П. Рука")).toBe(false);
    expect(hasCompressedHead(["Голова"])).toBe(true);
    expect(hasCompressedHead(["П. Рука"])).toBe(false);
  });
});

describe("allLimbsCompressed — только 4 руки/ноги, Голова не считается", () => {
  it("пусто/частично — false", () => {
    expect(allLimbsCompressed([])).toBe(false);
    expect(allLimbsCompressed(["П. Рука", "Л. Рука", "П. Нога"])).toBe(false);
  });
  it("все 4 руки/ноги без Головы — уже true", () => {
    expect(allLimbsCompressed(["П. Рука", "Л. Рука", "П. Нога", "Л. Нога"])).toBe(true);
  });
  it("Голова + 3 из 4 конечностей — всё ещё false (Голова не считается за конечность)", () => {
    expect(allLimbsCompressed(["Голова", "П. Рука", "Л. Рука", "П. Нога"])).toBe(false);
  });
});

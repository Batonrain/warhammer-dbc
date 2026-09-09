// test/rules/compression.test.mjs
//
// module/rules/compression.mjs (wdbc-1rno, мутация «Compression/Сжатие») —
// чистые функции состояния втянутых частей тела, без Foundry-зависимостей.

import { describe, it, expect } from "vitest";
import {
  COMPRESSIBLE_LOCATIONS, isCompressibleLocation, normalizeCompressibleLocation,
  retractPart, extendPart, isPartCompressed, hasCompressedHead, allLimbsCompressed
} from "../../module/rules/compression.mjs";

describe("isCompressibleLocation", () => {
  it("Торс нельзя втянуть — он и есть место, куда всё втягивается", () => {
    expect(isCompressibleLocation("Торс")).toBe(false);
  });
  it("Голова/руки/ноги — можно", () => {
    for (const loc of COMPRESSIBLE_LOCATIONS) expect(isCompressibleLocation(loc)).toBe(true);
  });
});

// wdbc-8dyp: Избирательная атака (стр. 35) называет часть тела БЕЗ стороны
// (AIM_LOCATIONS, combat/attack-outcome.mjs) — «Рука»/«Нога»/«Сочленение /
// Шея»/«Глаз (Голова)». Раньше это НЕ входило в COMPRESSIBLE_LOCATIONS
// (там только метки со стороной) — кнопка Сжатия не появлялась на прицельный
// удар по конечности, хотя книжный текст мутации не отличает прицельное
// попадание от случайного.
describe("normalizeCompressibleLocation — метки Избирательной атаки без стороны (wdbc-8dyp)", () => {
  it("«Рука»/«Нога» без стороны нормализуются в П. Рука/П. Нога (та же конвенция, что LOCATION_TO_ARMOR в combat/damage.mjs)", () => {
    expect(normalizeCompressibleLocation("Рука")).toBe("П. Рука");
    expect(normalizeCompressibleLocation("Нога")).toBe("П. Нога");
  });
  it("«Сочленение / Шея» и «Глаз (Голова)» — попадание в голову (стр. 35: «попадание в глаз — это попадание в голову»)", () => {
    expect(normalizeCompressibleLocation("Сочленение / Шея")).toBe("Голова");
    expect(normalizeCompressibleLocation("Глаз (Голова)")).toBe("Голова");
  });
  it("уже сторонние метки и Торс проходят как есть", () => {
    for (const loc of [...COMPRESSIBLE_LOCATIONS, "Торс"]) {
      expect(normalizeCompressibleLocation(loc)).toBe(loc);
    }
  });
});

describe("isCompressibleLocation — метки Избирательной атаки теперь тоже дают кнопку", () => {
  it("Рука/Нога/Сочленение/Глаз — компрессируемы после нормализации", () => {
    for (const loc of ["Рука", "Нога", "Сочленение / Шея", "Глаз (Голова)"]) {
      expect(isCompressibleLocation(loc)).toBe(true);
    }
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

  // wdbc-8dyp: если location пришёл без стороны (attack-card.mjs уже
  // нормализует перед этим сам, но retractPart остаётся защищённой сама по
  // себе — экспортирована и может быть вызвана напрямую), в список
  // попадает КАНОНИЧЕСКАЯ метка, а не сырая — иначе «сжав ВСЕ конечности»
  // (allLimbsCompressed, ищет именно «П. Рука»/«Л. Рука»/«П. Нога»/«Л. Нога»)
  // никогда не сработала бы после Избирательной атаки.
  it("нормализует метку без стороны перед сохранением", () => {
    expect(retractPart([], "Рука")).toEqual(["П. Рука"]);
    expect(retractPart([], "Нога")).toEqual(["П. Нога"]);
    expect(retractPart([], "Сочленение / Шея")).toEqual(["Голова"]);
    expect(retractPart([], "Глаз (Голова)")).toEqual(["Голова"]);
  });
  it("нормализованная и уже сторонняя метка не дублируются", () => {
    expect(retractPart(["П. Рука"], "Рука")).toEqual(["П. Рука"]);
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

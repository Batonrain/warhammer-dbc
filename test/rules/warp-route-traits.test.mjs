import { describe, it, expect } from "vitest";
import {
  routeCategoryFor, routeTypeFor, routeLoreFor, routeIlluminationFor, routeStabilityFor, routeFeatureFor,
  routeNavigationCap, routeEncounterCap, generateRouteTraits, effectiveIllumination
} from "../../module/rules/warp-route-traits.mjs";

describe("таблицы признаков маршрута: полное покрытие 1d10/d100", () => {
  it("Категория покрывает 1..10 без дырок и перекрытий", () => {
    for (let roll = 1; roll <= 10; roll++) expect(routeCategoryFor(roll)).toBeTruthy();
  });
  it("Тип/Изученность/Освещённость/Стабильность — тоже 1..10", () => {
    for (let roll = 1; roll <= 10; roll++) {
      expect(routeTypeFor(roll)).toBeTruthy();
      expect(routeLoreFor(roll)).toBeTruthy();
      expect(routeIlluminationFor(roll)).toBeTruthy();
      expect(routeStabilityFor(roll)).toBeTruthy();
    }
  });
  it("Особенности покрывают 1..100", () => {
    for (let roll = 1; roll <= 100; roll += 7) expect(routeFeatureFor(roll)).toBeTruthy();
    expect(routeFeatureFor(100).label).toBe("Интуитивный");
    expect(routeFeatureFor(1).label).toBe("Эхо трагедии");
  });

  it("книжные крайние случаи по имени", () => {
    expect(routeCategoryFor(1).label).toBe("Прямой маршрут");
    expect(routeCategoryFor(10).label).toBe("Запутанный маршрут");
    expect(routeCategoryFor(10).durMult).toBe(3);
    expect(routeLoreFor(10).forcesUnknown).toBe(true);
    expect(routeIlluminationFor(10).repeatImpossible).toBe(true);
    expect(routeStabilityFor(10).storm).toBe(true);
  });
});

describe("routeNavigationCap: потолок −60..+40 (Тип+Изученность+Знание)", () => {
  it("сумма в пределах — возвращается как есть", () => {
    expect(routeNavigationCap(10, 10, 10)).toBe(30);
  });
  it("выше +40 — капается", () => {
    expect(routeNavigationCap(10, 10, 30)).toBe(40);
  });
  it("ниже −60 — капается", () => {
    expect(routeNavigationCap(-10, -30, -30)).toBe(-60);
  });
});

describe("routeEncounterCap: потолок −30..+40 (Стабильность+Категория+Знамения)", () => {
  it("сумма в пределах", () => {
    expect(routeEncounterCap(10, 0, false)).toBe(10);
  });
  it("Дурные знамения не подавлены добавляют +20", () => {
    expect(routeEncounterCap(0, 0, true)).toBe(20);
  });
  it("капается сверху", () => {
    expect(routeEncounterCap(30, 10, true)).toBe(40);
  });
  it("капается снизу", () => {
    expect(routeEncounterCap(-10, 0, false)).toBe(-10);
    expect(routeEncounterCap(-10, -30, false)).toBe(-30);
  });
});

describe("generateRouteTraits: бросок всех признаков разом", () => {
  it("каждый из пяти признаков в допустимом диапазоне 1..10", () => {
    for (let i = 0; i < 20; i++) {
      const t = generateRouteTraits(0);
      for (const key of ["category", "routeType", "lore", "illumination", "stability"]) {
        expect(t[key].rating).toBeGreaterThanOrEqual(1);
        expect(t[key].rating).toBeLessThanOrEqual(10);
        expect(t[key].label).toBeTruthy();
      }
    }
  });

  it("featureCount=0 — пустой список Особенностей", () => {
    expect(generateRouteTraits(0).features).toEqual([]);
  });

  it("featureCount=3 — три РАЗНЫЕ особенности без повтора имени", () => {
    const t = generateRouteTraits(3);
    expect(t.features).toHaveLength(3);
    const names = t.features.map(f => f.name);
    expect(new Set(names).size).toBe(3);
    for (const f of t.features) {
      expect(f.roll).toBeGreaterThanOrEqual(1);
      expect(f.roll).toBeLessThanOrEqual(100);
      expect(f.effect).toBeTruthy();
    }
  });
});

describe("effectiveIllumination: «Ясный считается Тусклым» для Неизвестного маршрута", () => {
  it("Ясный + Неизвестный маршрут → числа Тусклого", () => {
    const yasny = routeIlluminationFor(4); // 2-6 = Ясный
    const eff = effectiveIllumination(yasny, "unknown");
    expect(eff.label).toBe("Тусклый");
  });
  it("Ясный + Известный маршрут → без изменений", () => {
    const yasny = routeIlluminationFor(4);
    expect(effectiveIllumination(yasny, "known")).toBe(yasny);
  });
  it("Светозарный НЕ понижается даже на Неизвестном маршруте", () => {
    const svet = routeIlluminationFor(1);
    expect(effectiveIllumination(svet, "unknown")).toBe(svet);
  });
  it("null проходит насквозь", () => {
    expect(effectiveIllumination(null, "unknown")).toBeNull();
  });
});

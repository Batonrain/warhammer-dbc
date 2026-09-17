import { describe, it, expect } from "vitest";
import {
  plottingThresholdFor, routePointsFromTest, astromancyOutcome,
  chartingModifier, chartingBlocked, chartingOutcome, knowledgeFromCharting,
  KNOWLEDGE_LADDER, knowledgeRankOf, upgradeKnowledge, passIncrement, PASSES_TO_LEARNED
} from "../../module/rules/warp-route-charting.mjs";

describe("plottingThresholdFor: Таблица Порога прокладки по дням", () => {
  it("книжные границы", () => {
    expect(plottingThresholdFor(1).threshold).toBe(3);
    expect(plottingThresholdFor(5).threshold).toBe(3);
    expect(plottingThresholdFor(6).threshold).toBe(5);
    expect(plottingThresholdFor(30).threshold).toBe(8);
    expect(plottingThresholdFor(31).threshold).toBe(12);
    expect(plottingThresholdFor(190).threshold).toBe(16);
    expect(plottingThresholdFor(191).threshold).toBe(20);
    expect(plottingThresholdFor(300).threshold).toBe(20);
  });
  it("за пределами таблицы (>300) — верхняя граница, не исключение", () => {
    expect(plottingThresholdFor(9999).threshold).toBe(20);
  });
});

describe("routePointsFromTest: Очки Маршрута от степени успеха", () => {
  it("успех — floor(deg/2)", () => {
    expect(routePointsFromTest(1)).toBe(0);
    expect(routePointsFromTest(2)).toBe(1);
    expect(routePointsFromTest(5)).toBe(2);
  });
  it("провал теста — 0 очков, не минус", () => {
    expect(routePointsFromTest(-3)).toBe(0);
  });
});

describe("astromancyOutcome: Обработка данных", () => {
  it("успех — очки полностью + бонус за лишние СУ, можно записывать", () => {
    expect(astromancyOutcome(10, 1)).toEqual({ points: 10, canRecord: true });
    expect(astromancyOutcome(10, 3)).toEqual({ points: 12, canRecord: true });
  });
  it("провал — половина очков (округление вниз), запись невозможна", () => {
    expect(astromancyOutcome(10, -1)).toEqual({ points: 5, canRecord: false });
    expect(astromancyOutcome(7, -2)).toEqual({ points: 3, canRecord: false });
  });
});

describe("chartingModifier: Trade (Astrographer) для Начертания маршрута", () => {
  it("точность выхода — +10/−10/−30", () => {
    expect(chartingModifier({ exitAccuracy: "exact" })).toBe(10);
    expect(chartingModifier({ exitAccuracy: "slight" })).toBe(-10);
    expect(chartingModifier({ exitAccuracy: "significant" })).toBe(-30);
  });
  it("Категория «Прямой маршрут» — доп. +10", () => {
    expect(chartingModifier({ exitAccuracy: "exact", categoryLabel: "Прямой маршрут" })).toBe(20);
  });
  it("Особенность «Интуитивный» — доп. −20", () => {
    expect(chartingModifier({ exitAccuracy: "exact", featureLabels: ["Интуитивный"] })).toBe(-10);
  });
  it("все модификаторы складываются", () => {
    expect(chartingModifier({ exitAccuracy: "significant", categoryLabel: "Прямой маршрут", featureLabels: ["Интуитивный"] }))
      .toBe(-30 + 10 - 20);
  });
});

describe("chartingBlocked / chartingOutcome / knowledgeFromCharting", () => {
  it("«Неначертаемый след» блокирует запись целиком", () => {
    expect(chartingBlocked("Неначертаемый след")).toBe(true);
    expect(chartingBlocked("Прямой маршрут")).toBe(false);
  });
  it("успех — Детализированная; провал — Базовая; 4+ провала — нет записи", () => {
    expect(chartingOutcome(2)).toBe("detailed");
    expect(chartingOutcome(-1)).toBe("basic");
    expect(chartingOutcome(-3)).toBe("basic");
    expect(chartingOutcome(-4)).toBe("none");
    expect(chartingOutcome(-6)).toBe("none");
  });
  it("Детализированная → Известный, Базовая → Предполагаемый, нет записи → null", () => {
    expect(knowledgeFromCharting("detailed")).toBe("known");
    expect(knowledgeFromCharting("basic")).toBe("presumed");
    expect(knowledgeFromCharting("none")).toBeNull();
  });
});

describe("Рост Знания: лестница и повышение без понижения", () => {
  it("порядок лестницы", () => {
    expect(KNOWLEDGE_LADDER).toEqual(["unknown", "presumed", "known", "learned", "chosen"]);
  });
  it("knowledgeRankOf — индекс, неизвестное значение как unknown (0)", () => {
    expect(knowledgeRankOf("known")).toBe(2);
    expect(knowledgeRankOf("garbage")).toBe(0);
  });
  it("upgradeKnowledge поднимает только вверх", () => {
    expect(upgradeKnowledge("unknown", "known")).toBe("known");
    expect(upgradeKnowledge("learned", "presumed")).toBe("learned"); // не понижает
    expect(upgradeKnowledge("known", "known")).toBe("known");
  });
  it("proposed=null — оставляет текущее", () => {
    expect(upgradeKnowledge("presumed", null)).toBe("presumed");
  });
});

describe("passIncrement / PASSES_TO_LEARNED", () => {
  it("обычный маршрут — 1 проход = 1 шаг", () => {
    expect(passIncrement([])).toBe(1);
  });
  it("«Интуитивный» — каждый проход считается за два", () => {
    expect(passIncrement(["Интуитивный"])).toBe(2);
  });
  it("порог Известный→Выученный — 10", () => {
    expect(PASSES_TO_LEARNED).toBe(10);
  });
});

// test/rules/personal-adaptation.test.mjs
//
// Personal Adaptation / Персональная Адаптация (wdbc-1rno, Тзинч): чистая
// логика роста/капа/протухания бонуса против конкретной цели. Применение
// (прибавка к Порогу, запись после разрешения) — интеграционные тесты в
// test/rules/kind-outcome.test.mjs и test/sheets/psychic.test.mjs-подобных
// местах (см. точки подключения в шапке rules/personal-adaptation.mjs).

import "../support/foundry-stub.mjs";
import { describe, it, expect } from "vitest";
import {
  personalAdaptationCap, personalAdaptationBonusFor, nextPersonalAdaptationBonuses, NINE_YEARS
} from "../../module/rules/personal-adaptation.mjs";

describe("personalAdaptationCap", () => {
  it("округление ½Cor.b вверх, ×5", () => {
    expect(personalAdaptationCap(0)).toBe(0);
    expect(personalAdaptationCap(1)).toBe(5);   // ½×1=0.5 → 1 → ×5
    expect(personalAdaptationCap(2)).toBe(5);   // ½×2=1 → ×5
    expect(personalAdaptationCap(3)).toBe(10);  // ½×3=1.5 → 2 → ×5
    expect(personalAdaptationCap(10)).toBe(25); // ½×10=5 → ×5
  });

  it("отрицательный/нечисловой Cor.b — 0, не падает", () => {
    expect(personalAdaptationCap(-5)).toBe(0);
    expect(personalAdaptationCap(undefined)).toBe(0);
    expect(personalAdaptationCap(null)).toBe(0);
  });
});

describe("personalAdaptationBonusFor", () => {
  it("нет записи — 0", () => {
    expect(personalAdaptationBonusFor([], "Actor.a", 1000)).toBe(0);
  });

  it("живая запись — её бонус", () => {
    const list = [{ targetUuid: "Actor.a", bonus: 15, expiresAt: 2000 }];
    expect(personalAdaptationBonusFor(list, "Actor.a", 1000)).toBe(15);
  });

  it("протухшая (worldTime >= expiresAt) — 0", () => {
    const list = [{ targetUuid: "Actor.a", bonus: 15, expiresAt: 1000 }];
    expect(personalAdaptationBonusFor(list, "Actor.a", 1000)).toBe(0);
    expect(personalAdaptationBonusFor(list, "Actor.a", 1001)).toBe(0);
    expect(personalAdaptationBonusFor(list, "Actor.a", 999)).toBe(15);
  });

  it("запись другой цели не путается", () => {
    const list = [{ targetUuid: "Actor.a", bonus: 15, expiresAt: 2000 }];
    expect(personalAdaptationBonusFor(list, "Actor.b", 1000)).toBe(0);
  });
});

describe("nextPersonalAdaptationBonuses", () => {
  it("первый встречный тест против новой цели — +5", () => {
    const next = nextPersonalAdaptationBonuses([], "Actor.a", 1000, 25);
    expect(next).toEqual([{ targetUuid: "Actor.a", bonus: 5, expiresAt: 1000 + NINE_YEARS }]);
  });

  it("растёт на +5 от живой записи", () => {
    const list = [{ targetUuid: "Actor.a", bonus: 10, expiresAt: 5000 }];
    const next = nextPersonalAdaptationBonuses(list, "Actor.a", 1000, 25);
    expect(next.find(r => r.targetUuid === "Actor.a").bonus).toBe(15);
  });

  it("капируется потолком Cor.b и дальше не растёт", () => {
    const list = [{ targetUuid: "Actor.a", bonus: 25, expiresAt: 5000 }];
    const next = nextPersonalAdaptationBonuses(list, "Actor.a", 1000, 25);
    expect(next.find(r => r.targetUuid === "Actor.a").bonus).toBe(25);
  });

  it("протухшая запись стартует заново с +5, не с продолжения старого числа", () => {
    const list = [{ targetUuid: "Actor.a", bonus: 25, expiresAt: 1000 }];
    const next = nextPersonalAdaptationBonuses(list, "Actor.a", 1000, 25);
    expect(next.find(r => r.targetUuid === "Actor.a").bonus).toBe(5);
  });

  it("срок всегда переставляется на 9 лет от ТЕКУЩЕГО worldTime", () => {
    const list = [{ targetUuid: "Actor.a", bonus: 10, expiresAt: 5000 }];
    const next = nextPersonalAdaptationBonuses(list, "Actor.a", 9000, 25);
    expect(next.find(r => r.targetUuid === "Actor.a").expiresAt).toBe(9000 + NINE_YEARS);
  });

  it("записи ДРУГИХ целей сохраняются нетронутыми", () => {
    const list = [
      { targetUuid: "Actor.a", bonus: 10, expiresAt: 5000 },
      { targetUuid: "Actor.b", bonus: 20, expiresAt: 6000 }
    ];
    const next = nextPersonalAdaptationBonuses(list, "Actor.a", 1000, 25);
    expect(next.find(r => r.targetUuid === "Actor.b")).toEqual({ targetUuid: "Actor.b", bonus: 20, expiresAt: 6000 });
  });
});

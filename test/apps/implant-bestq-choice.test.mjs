// test/apps/implant-bestq-choice.test.mjs
//
// Best.Q-биоимпланты Друкхари (wdbc-ukpu, шаг 3): выбор бонусного эффекта при
// получении экземпляра — цена (+1 Доступность за доп. эффект сверх первого,
// включая повтор одного и того же варианта) и запись прямо в поля предмета
// (system.chosenEffects/system.availability), не в Механику Конструктора.

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { fakeHtml, captured, resetCaptured } from "../support/foundry-stub.mjs";
import {
  needsBestQChoice, bestQChoiceUpdate, bestQChoicePreview,
  promptBestQChoice, runBestQChoice
} from "../../module/apps/implant-bestq-choice.mjs";

const OPTIONS = [
  { label: "Unnatural S", note: "усиливает Руку Гладиатора" },
  { label: "скрытая полость", note: "Awareness-20" },
  { label: "встроенный инструмент", note: "" }
];

describe("needsBestQChoice", () => {
  it("Best.Q со списком вариантов и без выбора — нужен диалог", () => {
    const item = { system: { quality: "best", bestQualityEffects: OPTIONS, chosenEffects: [] } };
    expect(needsBestQChoice(item)).toBe(true);
  });

  it("выбор уже сделан (chosenEffects непуст) — диалог не нужен", () => {
    const item = { system: { quality: "best", bestQualityEffects: OPTIONS, chosenEffects: [{ label: "Unnatural S", note: "" }] } };
    expect(needsBestQChoice(item)).toBe(false);
  });

  it("не Best.Q качество — диалог не нужен, даже если варианты есть", () => {
    const item = { system: { quality: "common", bestQualityEffects: OPTIONS, chosenEffects: [] } };
    expect(needsBestQChoice(item)).toBe(false);
  });

  it("Best.Q, но у обычного импланта нет вариантов вовсе — диалог не нужен", () => {
    const item = { system: { quality: "best", bestQualityEffects: [], chosenEffects: [] } };
    expect(needsBestQChoice(item)).toBe(false);
  });

  it("предмет без system — не падает, false", () => {
    expect(needsBestQChoice({})).toBe(false);
    expect(needsBestQChoice(null)).toBe(false);
  });
});

describe("bestQChoiceUpdate: чистый пересчёт цены выбора", () => {
  it("один эффект — Доступность не меняется (базовый эффект бесплатен)", () => {
    const update = bestQChoiceUpdate(OPTIONS, [1, 0, 0], 2);
    expect(update["system.chosenEffects"]).toEqual([{ label: "Unnatural S", note: "усиливает Руку Гладиатора" }]);
    expect(update["system.availability"]).toBe(2); // база не выросла
  });

  it("три эффекта разных вариантов — +2 к базовой Доступности (2 сверх первого)", () => {
    const update = bestQChoiceUpdate(OPTIONS, [1, 1, 1], 2);
    expect(update["system.chosenEffects"]).toHaveLength(3);
    expect(update["system.availability"]).toBe(4);
  });

  it("книжное правило руки-хищника: один и тот же вариант дважды — тоже считается доп. эффектом", () => {
    const update = bestQChoiceUpdate(OPTIONS, [2, 0, 0], 0);
    expect(update["system.chosenEffects"]).toEqual([
      { label: "Unnatural S", note: "усиливает Руку Гладиатора" },
      { label: "Unnatural S", note: "усиливает Руку Гладиатора" }
    ]);
    expect(update["system.availability"]).toBe(1); // 2 эффекта → +1 к базе 0
  });

  it("ничего не выбрано (все счётчики 0) — null, писать нечего", () => {
    expect(bestQChoiceUpdate(OPTIONS, [0, 0, 0], 3)).toBe(null);
    expect(bestQChoiceUpdate(OPTIONS, [], 3)).toBe(null);
  });

  it("отрицательные/мусорные значения счётчиков не портят пересчёт", () => {
    const update = bestQChoiceUpdate(OPTIONS, [-5, 1, NaN], 1);
    expect(update["system.chosenEffects"]).toHaveLength(1);
    expect(update["system.availability"]).toBe(1);
  });
});

describe("bestQChoicePreview: живой счётчик диалога", () => {
  it("считает сумму и прогноз Доступности так же, как итоговый пересчёт", () => {
    expect(bestQChoicePreview([1, 1, 0], 2)).toEqual({ total: 2, availability: 3 });
    expect(bestQChoicePreview([0, 0, 0], 2)).toEqual({ total: 0, availability: 2 });
    expect(bestQChoicePreview([3, 0, 0], -1)).toEqual({ total: 3, availability: 1 });
  });
});

describe("promptBestQChoice: диалог", () => {
  function fakeItem(overrides = {}) {
    return { name: "Flesh-Crafted Arm", system: { bestQualityEffects: OPTIONS, availability: 2, ...overrides } };
  }

  it("Принять — читает числовые поля по data-idx в массив counts", async () => {
    resetCaptured();
    const promise = promptBestQChoice(fakeItem());
    const counts = [
      { dataset: { idx: "0" }, value: "1" },
      { dataset: { idx: "1" }, value: "0" },
      { dataset: { idx: "2" }, value: "2" }
    ];
    const html = fakeHtml({}, { ".bestq-count": counts });
    captured.dialog.buttons.ok.callback(html);
    expect(await promise).toEqual([1, 0, 2]);
  });

  it("Отмена — null", async () => {
    resetCaptured();
    const promise = promptBestQChoice(fakeItem());
    captured.dialog.buttons.cancel.callback();
    expect(await promise).toBe(null);
  });

  it("закрытие без ответа (крестик) — null, как и Отмена", async () => {
    resetCaptured();
    const promise = promptBestQChoice(fakeItem());
    captured.dialog.close();
    expect(await promise).toBe(null);
  });

  it("нет вариантов вовсе — сразу null, без диалога", async () => {
    resetCaptured();
    expect(await promptBestQChoice(fakeItem({ bestQualityEffects: [] }))).toBe(null);
    expect(captured.dialog).toBe(null);
  });
});

describe("runBestQChoice: полный цикл спросить+записать", () => {
  function fakeItem(overrides = {}) {
    const updates = [];
    return {
      name: "Flesh-Crafted Arm",
      system: { bestQualityEffects: OPTIONS, availability: 2, chosenEffects: [], ...overrides },
      update: async data => { updates.push(data); return data; },
      _updates: updates
    };
  }

  it("выбор сделан — пишет chosenEffects и пересчитанную Доступность одним update", async () => {
    resetCaptured();
    const item = fakeItem();
    const promise = runBestQChoice(item);
    const counts = [{ dataset: { idx: "0" }, value: "1" }, { dataset: { idx: "1" }, value: "1" }, { dataset: { idx: "2" }, value: "0" }];
    captured.dialog.buttons.ok.callback(fakeHtml({}, { ".bestq-count": counts }));
    expect(await promise).toBe(true);
    expect(item._updates).toHaveLength(1);
    expect(item._updates[0]["system.chosenEffects"]).toHaveLength(2);
    expect(item._updates[0]["system.availability"]).toBe(3); // 2 эффекта → +1 к базе 2
  });

  it("диалог отменён — update не шлётся вовсе", async () => {
    resetCaptured();
    const item = fakeItem();
    const promise = runBestQChoice(item);
    captured.dialog.buttons.cancel.callback();
    expect(await promise).toBe(false);
    expect(item._updates).toHaveLength(0);
  });

  it("Принять с нулём во всех полях — тоже не пишет ничего (как отказ)", async () => {
    resetCaptured();
    const item = fakeItem();
    const promise = runBestQChoice(item);
    const counts = [{ dataset: { idx: "0" }, value: "0" }, { dataset: { idx: "1" }, value: "0" }, { dataset: { idx: "2" }, value: "0" }];
    captured.dialog.buttons.ok.callback(fakeHtml({}, { ".bestq-count": counts }));
    expect(await promise).toBe(false);
    expect(item._updates).toHaveLength(0);
  });
});

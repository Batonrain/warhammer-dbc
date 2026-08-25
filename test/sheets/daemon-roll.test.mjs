// test/sheets/daemon-roll.test.mjs
//
// Раскатка «Вида теста» на Нестабильность Демона (см. память
// doombc-test-kind-rollout): полный набор, но БЕЗ Кубика — книга даёт
// максимум один автопереброс, ручного выбора Преимущества/Помехи нет.

import { describe, it, expect, beforeEach } from "vitest";
import "../support/foundry-stub.mjs";
import { captured, resetCaptured, fakeForm } from "../support/foundry-stub.mjs";
import { WarhammerDaemonSheet } from "../../module/sheets/daemon-sheet.mjs";

function daemonActor(over = {}) {
  const flags = {};
  return {
    name: "Кровожад", id: "daemon-1",
    system: {
      characteristics: { wp: { total: 50 } },
      instabilityRating: 3,
      ...over
    },
    items: [],
    getFlag: (scope, key) => key.split(".").reduce((o, k) => o?.[k], flags[scope]),
    setFlag: async (scope, key, value) => {
      flags[scope] ??= {};
      const parts = key.split(".");
      let node = flags[scope];
      for (const k of parts.slice(0, -1)) node = (node[k] ??= {});
      node[parts.at(-1)] = value;
    }
  };
}

function sheetOf(actor) {
  return Object.assign(Object.create(WarhammerDaemonSheet.prototype), { actor });
}

beforeEach(resetCaptured);

describe("_rollInstability: Вид теста/Сложность без Кубика", () => {
  it("диалог не предлагает Кубик — только Вид теста и Сложность", async () => {
    const sheet = sheetOf(daemonActor());
    const promise = sheet._rollInstability();
    expect(captured.dialog).toBeTruthy();
    expect(captured.dialog.content).toContain("test-kind");
    expect(captured.dialog.content).not.toContain("dice-mode-opt");

    captured.nextRoll = 60;
    await captured.press("roll", fakeForm());
    await promise;
    expect(captured.rolls).toEqual(["1d100"]);
  });

  it("Базовый тест: Порог = W, Успех/Провал считаются от него", async () => {
    const sheet = sheetOf(daemonActor({ characteristics: { wp: { total: 40 } } }));
    const promise = sheet._rollInstability();
    captured.nextRoll = 35;
    await captured.press("roll", fakeForm());
    await promise;

    expect(captured.chat[0].content).toContain("Порог: <b>40</b>");
    expect(captured.chat[0].content).toContain("Удержался");
  });

  it("Сложность входит в Порог", async () => {
    const sheet = sheetOf(daemonActor({ characteristics: { wp: { total: 40 } } }));
    const promise = sheet._rollInstability();
    captured.nextRoll = 25;
    await captured.press("roll", fakeForm({ "#test-difficulty": "-20" }));
    await promise;

    expect(captured.chat[0].content).toContain("Порог: <b>20</b>");
    expect(captured.chat[0].content).toContain("Дестабилизация");
  });

  it("Комбинированный: Порог — наименьший из двух", async () => {
    const sheet = sheetOf(daemonActor({ characteristics: { wp: { total: 50 } } }));
    const promise = sheet._rollInstability();
    captured.nextRoll = 30;
    await captured.press("roll", fakeForm({
      "#test-kind": "combined", "#combined-char-select": "ag", "#combined-target": "25"
    }));
    await promise;

    // 30 <= 50 (был бы успех), но 30 > 25 (итоговый минимум) → дестабилизация.
    expect(captured.chat[0].content).toContain("Комбинированный");
    expect(captured.chat[0].content).toContain("Дестабилизация");
  });

  it("натуральный 1-5 — Критический Успех виден в карточке", async () => {
    const sheet = sheetOf(daemonActor());
    const promise = sheet._rollInstability();
    captured.nextRoll = 2;
    await captured.press("roll", fakeForm());
    await promise;

    expect(captured.chat[0].content).toContain("Критический Успех");
  });

  it("Отмена диалога — броска не происходит", async () => {
    const sheet = sheetOf(daemonActor());
    const promise = sheet._rollInstability();
    await captured.press("cancel", fakeForm());
    await promise;

    expect(captured.chat).toHaveLength(0);
  });
});

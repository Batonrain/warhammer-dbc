// test/combat/vehicle-orbital-fire-fallbreaks.test.mjs
//
// wdbc-y33b: Орбитальная высадка (2 Хода, чат-карточки), Пожар: тест
// детонации (Взрывоопасная снижает порог 10+→6+), Тормоза Падения (Крушение
// с Низкой высоты → с Приземной, лимит раз за бой/сцену).

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured, fakeHtml } from "../support/foundry-stub.mjs";
import { showOrbitalDeployTurn1, showOrbitalDeployTurn2,
         showFireDetonationDialog, showFallBreaksDialog } from "../../module/combat/vehicle.mjs";

function vehicle(traitFlags = {}, overrides = {}) {
  const updates = [];
  return {
    type: "vehicle", name: "Thunderhawk",
    system: {
      structure: { value: 20, critical: 0 },
      damageStates: [],
      fallBreaksUsed: false,
      derived: { traitFlags },
      ...overrides
    },
    update: async data => { updates.push(data); Object.assign(overrides, data); },
    _updates: updates
  };
}

beforeEach(resetCaptured);

describe("Орбитальная высадка", () => {
  it("Ход 1 — влетает на Высокую высоту, −30 по машине", async () => {
    const v = vehicle();
    await showOrbitalDeployTurn1(v);
    const card = captured.chat.at(-1).content;
    expect(card).toContain("Высокую высоту");
    expect(card).toContain("−30");
  });

  it("Ход 2 — смещение 2d10 и направление 1d8, штраф стрельбы −20", async () => {
    captured.dice = [4, 6, 5]; // 2d10=10, 1d8=5 → "юг" (индекс 4)
    const v = vehicle();
    await showOrbitalDeployTurn2(v);
    const card = captured.chat.at(-1).content;
    expect(card).toContain("<b>10</b> м");
    expect(card).toContain("юг");
    expect(card).toContain("−20");
    expect(card).toContain("Тараном");
  });
});

describe("Пожар: тест детонации", () => {
  it("без Взрывоопасной — порог 10+ виден в диалоге", async () => {
    const v = vehicle({});
    await showFireDetonationDialog(v);
    expect(captured.dialog.content).toContain("≥ 10");
    expect(captured.dialog.content).not.toContain("Взрывоопасная");
  });

  it("с Взрывоопасной — порог снижен до 6+", async () => {
    const v = vehicle({ volatile: true });
    await showFireDetonationDialog(v);
    expect(captured.dialog.content).toContain("≥ 6");
    expect(captured.dialog.content).toContain("Взрывоопасная: порог снижен");
  });

  it("детонация (сумма ≥ порога) — 8 непоглощаемого урона машине", async () => {
    captured.dice = [8]; // 1d10=8, +2 хода Пожара = 10 ≥ 10
    const v = vehicle({});
    await showFireDetonationDialog(v);
    await captured.dialog.buttons.roll.callback(fakeHtml({ "#fd-turns": "2" }));

    expect(v._updates).toEqual([{ "system.structure.value": 12, "system.structure.critical": 0 }]);
    const card = captured.chat.at(-1).content;
    expect(card).toContain("Детонация");
  });

  it("Взрывоопасная упоминает вторичные эффекты взрыва при детонации", async () => {
    captured.dice = [6];
    const v = vehicle({ volatile: true });
    await showFireDetonationDialog(v);
    await captured.dialog.buttons.roll.callback(fakeHtml({ "#fd-turns": "0" }));

    const card = captured.chat.at(-1).content;
    expect(card).toContain("Загораются");
  });

  it("без детонации — актор не обновляется", async () => {
    captured.dice = [1];
    const v = vehicle({});
    await showFireDetonationDialog(v);
    await captured.dialog.buttons.roll.callback(fakeHtml({ "#fd-turns": "0" }));

    expect(v._updates).toEqual([]);
    const card = captured.chat.at(-1).content;
    expect(card).toContain("Без детонации");
  });
});

describe("Тормоза Падения", () => {
  it("без Черты — предупреждение, диалог не открывается", async () => {
    const v = vehicle({});
    await showFallBreaksDialog(v);
    expect(captured.warnings.at(-1)).toContain("нет Черты Тормоза Падения");
    expect(captured.dialog).toBeFalsy();
  });

  it("уже использованы в этом бою — предупреждение", async () => {
    const v = vehicle({ fallBreaks: true }, { fallBreaksUsed: true });
    await showFallBreaksDialog(v);
    expect(captured.warnings.at(-1)).toContain("уже использованы");
  });

  it("подтверждение — добавляет поломку, ставит флаг использования", async () => {
    captured.confirmAnswer = true;
    const v = vehicle({ fallBreaks: true });
    await showFallBreaksDialog(v);

    expect(v._updates[0]["system.fallBreaksUsed"]).toBe(true);
    expect(v._updates[0]["system.damageStates"]).toEqual([
      expect.objectContaining({ label: "Ходовая Часть Повреждена" })
    ]);
    const card = captured.chat.at(-1).content;
    expect(card).toContain("Приземной высоты");
  });

  it("отмена — ничего не меняется", async () => {
    captured.confirmAnswer = false;
    const v = vehicle({ fallBreaks: true });
    await showFallBreaksDialog(v);
    expect(v._updates).toEqual([]);
  });
});

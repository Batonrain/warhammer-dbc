// test/combat/recognize-stance.test.mjs
//
// Стойки (стр. 15, wdbc-x1nz.2.66.11): «Раз в Ход персонаж может пройти
// тест Awareness(WS)+20, чтобы понять чужие стойки. Если Предел этого
// теста 75+, это автоуспех.»

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach } from "vitest";
import { awarenessOnWs, rollRecognizeStance } from "../../module/combat/recognize-stance.mjs";

function actorWith({ ws = 45, per = 40, awarenessTotal = null, ...extra } = {}) {
  const flags = {};
  return {
    name: "Наблюдатель",
    system: {
      characteristics: { ws: { total: ws }, per: { total: per } },
      skills: awarenessTotal != null ? { awareness: { total: awarenessTotal } } : {},
      ...extra
    },
    items: [],
    getFlag: (_s, k) => flags[k],
    setFlag: async (_s, k, v) => { flags[k] = v; }
  };
}

function targetWith(stance) {
  return { name: "Цель", system: { meleeStance: stance } };
}

beforeEach(() => {
  resetCaptured();
  globalThis.game.user = { ...globalThis.game.user, targets: new Set() };
  globalThis.game.combat = undefined;
});

describe("awarenessOnWs — тренировка Бдительности, перенесённая с Per на WS", () => {
  it("нетренированная Бдительность — голый WS", () => {
    expect(awarenessOnWs(actorWith({ ws: 45, per: 40 }))).toBe(45);
  });

  it("тренированная Бдительность (Per 40 → total 60, +20 надбавка) — та же +20 надбавка поверх WS", () => {
    expect(awarenessOnWs(actorWith({ ws: 45, per: 40, awarenessTotal: 60 }))).toBe(65); // 45 + (60-40)
  });
});

describe("rollRecognizeStance", () => {
  it("нет выцеленной цели — предупреждает, не бросает", async () => {
    const actor = actorWith();
    await rollRecognizeStance(actor);
    expect(captured.warnings.some(w => w.includes("цели"))).toBe(true);
    expect(captured.chat).toHaveLength(0);
  });

  it("успех — раскрывает Стойку цели в карточке", async () => {
    const actor = actorWith({ ws: 45 }); // threshold 45+20=65
    const target = targetWith("aggressive");
    globalThis.game.user.targets = new Set([{ actor: target }]);
    captured.dice = [10, 5]; // rv 10 ≤ 65 — успех
    await rollRecognizeStance(actor);
    expect(captured.chat.at(-1).content).toContain("Агрессивная");
  });

  it("провал — Стойка не раскрывается", async () => {
    const actor = actorWith({ ws: 10 }); // threshold 10+20=30
    const target = targetWith("aggressive");
    globalThis.game.user.targets = new Set([{ actor: target }]);
    captured.dice = [90, 5]; // rv 90 > 30 — провал
    await rollRecognizeStance(actor);
    expect(captured.chat.at(-1).content).not.toContain("Агрессивная");
  });

  it("Предел 75+ — автоуспех, даже на плохом броске", async () => {
    const actor = actorWith({ ws: 60 }); // threshold 60+20=80 ≥ 75
    const target = targetWith("springing");
    globalThis.game.user.targets = new Set([{ actor: target }]);
    captured.dice = [99, 9]; // заведомо провальный бросок
    await rollRecognizeStance(actor);
    expect(captured.chat.at(-1).content).toContain("Автоуспех");
    expect(captured.chat.at(-1).content).toContain("Пружинящая");
  });

  it("Предел ровно 75 — автоуспех (граница включительно)", async () => {
    const actor = actorWith({ ws: 55 }); // threshold 55+20=75, ровно на границе
    const target = targetWith("rapidstrike");
    globalThis.game.user.targets = new Set([{ actor: target }]);
    captured.dice = [99, 9]; // заведомо провальный бросок
    await rollRecognizeStance(actor);
    expect(captured.chat.at(-1).content).toContain("Автоуспех");
  });

  it("Предел 74 — граница НЕ включает, автоуспеха нет", async () => {
    const actor = actorWith({ ws: 54 }); // threshold 54+20=74
    const target = targetWith("rapidstrike");
    globalThis.game.user.targets = new Set([{ actor: target }]);
    captured.dice = [99, 9];
    await rollRecognizeStance(actor);
    expect(captured.chat.at(-1).content).not.toContain("Автоуспех");
  });

  it("Предел ниже 75 — обычный бросок, автоуспеха нет", async () => {
    const actor = actorWith({ ws: 40 }); // threshold 40+20=60 < 75
    const target = targetWith("springing");
    globalThis.game.user.targets = new Set([{ actor: target }]);
    captured.dice = [99, 9];
    await rollRecognizeStance(actor);
    expect(captured.chat.at(-1).content).not.toContain("Автоуспех");
    expect(captured.chat.at(-1).content).not.toContain("Пружинящая");
  });

  it("Раз в Ход — второй вызов в том же Раунде боя предупреждает, не бросает второй раз", async () => {
    globalThis.game.combat = { round: 1 };
    const actor = actorWith({ ws: 45 });
    const target = targetWith("aggressive");
    globalThis.game.user.targets = new Set([{ actor: target }]);

    captured.dice = [10, 5];
    await rollRecognizeStance(actor);
    expect(captured.chat).toHaveLength(1);

    resetCaptured();
    globalThis.game.user.targets = new Set([{ actor: target }]);
    captured.dice = [10, 5];
    await rollRecognizeStance(actor);
    expect(captured.chat).toHaveLength(0);
    expect(captured.warnings.some(w => w.includes("уже использовано"))).toBe(true);
  });

  it("Раз в Ход — новый Раунд снова разрешает бросок", async () => {
    globalThis.game.combat = { round: 1 };
    const actor = actorWith({ ws: 45 });
    const target = targetWith("aggressive");
    globalThis.game.user.targets = new Set([{ actor: target }]);
    captured.dice = [10, 5];
    await rollRecognizeStance(actor);

    resetCaptured();
    globalThis.game.combat = { round: 2 };
    globalThis.game.user.targets = new Set([{ actor: target }]);
    captured.dice = [10, 5];
    await rollRecognizeStance(actor);
    expect(captured.chat).toHaveLength(1);
  });
});

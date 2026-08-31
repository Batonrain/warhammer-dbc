// test/apps/infamy-points-gods.test.mjs
//
// wdbc-e3w0: правила Богов в способностях Очков Бесчестия (корбук 438)
// раньше были шестью проверками godKey==='...' в module/apps/infamy-points.mjs;
// теперь читаются из DP_PATRONAGE (module/constants/demon-prince.mjs) —
// healBlockedByBleeding/healFlat/healPenalty/successCorThreshold/successBonusDice.
// Матрица бог×способность здесь фиксирует прежнее поведение (снятое с кода
// ДО переноса на данные), чтобы перенос не изменил числа/условия.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach } from "vitest";
import { spendInfamy } from "../../module/apps/infamy-points.mjs";

// Заглушка foundry.utils.getProperty в стенде всегда отдаёт undefined (не
// нужна остальным тестам) — spendInfamy читает через неё текущий пул
// (foundry.utils.getProperty(actor, ipFullPath)), поэтому здесь нужна
// настоящая реализация по пути через точку.
foundry.utils.getProperty = (object, key) =>
  String(key).split(".").reduce((o, k) => o?.[k], object);

function actorWith({ cor = 0, bleeding = false, woundsValue = 10, woundsMax = 20, fateValue = 5 } = {}) {
  const actor = {
    system: {
      corruption: { value: cor },
      conditions: { bleeding, stunned: true, stunnedRounds: 2 },
      wounds: { value: woundsValue, max: woundsMax, critical: 3 },
      fatigue: { value: 4 },
      fate: { value: fateValue }
    },
    getFlag: () => undefined,
    setFlag: async () => {},
    unsetFlag: async () => {},
    update: async data => {
      captured.updates.push(data);
      for (const [path, value] of Object.entries(data)) {
        const keys = path.split(".");
        let node = actor;
        for (const k of keys.slice(0, -1)) node = (node[k] ??= {});
        node[keys.at(-1)] = value;
      }
    }
  };
  return actor;
}

const spend = (actor, key, godKey) =>
  spendInfamy(actor, key, { godKey, ipFullPath: "system.fate.value", ipMax: 20, meta: {} });

beforeEach(() => resetCaptured());

describe("spendInfamy — «Исцеление» по Богам (module/apps/infamy-points.mjs)", () => {
  it("Неделимый, Cor 0 — 1d5, без базы, без снятия Отрицательных Ран", async () => {
    captured.nextRoll = 3;
    const actor = actorWith({ cor: 0 });
    await spend(actor, "heal", "undivided");
    expect(actor.system.wounds.value).toBe(13);          // 10 + 3
    expect(actor.system.wounds.critical).toBe(3);         // не снято
  });

  it("Неделимый, Cor 20 — 1d5+1, снимает Отрицательные Раны", async () => {
    captured.nextRoll = 3;
    const actor = actorWith({ cor: 20 });
    await spend(actor, "heal", "undivided");
    expect(actor.system.wounds.value).toBe(14);           // 10 + 3 + 1
    expect(actor.system.wounds.critical).toBe(0);
  });

  it("Неделимый, Cor 60 — 1d10, снимает Отрицательные Раны", async () => {
    captured.nextRoll = 7;
    const actor = actorWith({ cor: 60 });
    await spend(actor, "heal", "undivided");
    expect(actor.system.wounds.value).toBe(17);            // 10 + 7
    expect(actor.system.wounds.critical).toBe(0);
  });

  it("Кхорн, Кровотечение — предупреждает и не лечит вовсе", async () => {
    const actor = actorWith({ cor: 20, bleeding: true });
    await spend(actor, "heal", "khorne");
    expect(captured.warnings.length).toBe(1);
    expect(captured.warnings[0]).toContain("Кхорн");
    expect(actor.system.wounds.value).toBe(10);
    expect(captured.chat.length).toBe(0);
  });

  it("Кхорн, без Кровотечения — лечит как обычно, но на 2 меньше (мин. 1)", async () => {
    captured.nextRoll = 3;
    const actor = actorWith({ cor: 0, bleeding: false });
    await spend(actor, "heal", "khorne");
    expect(actor.system.wounds.value).toBe(11);            // 10 + max(1, 3-2)=1
  });

  it("Кхорн — штраф не даёт уйти ниже 1 лечения", async () => {
    captured.nextRoll = 1;
    const actor = actorWith({ cor: 0, bleeding: false });
    await spend(actor, "heal", "khorne");
    expect(actor.system.wounds.value).toBe(11);            // max(1, 1-2)=1
  });

  it("Нургл, Cor 0 — максимум без броска (5), кубы не бросаются", async () => {
    const actor = actorWith({ cor: 0 });
    await spend(actor, "heal", "nurgle");
    expect(actor.system.wounds.value).toBe(15);             // 10 + 5
    expect(captured.rolls.length).toBe(0);
  });

  it("Нургл, Cor 20 — максимум без броска (6)", async () => {
    const actor = actorWith({ cor: 20 });
    await spend(actor, "heal", "nurgle");
    expect(actor.system.wounds.value).toBe(16);
    expect(captured.rolls.length).toBe(0);
  });

  it("Нургл, Cor 60 — максимум без броска (10)", async () => {
    const actor = actorWith({ cor: 60 });
    await spend(actor, "heal", "nurgle");
    expect(actor.system.wounds.value).toBe(20);
    expect(captured.rolls.length).toBe(0);
  });

  it("Тзинч — лечит как обычно (никаких особых правил Исцеления)", async () => {
    captured.nextRoll = 5;
    const actor = actorWith({ cor: 60 });
    await spend(actor, "heal", "tzeentch");
    expect(actor.system.wounds.value).toBe(15);             // 10 + 5, без штрафа/флэта
  });
});

describe("spendInfamy — «Успех» по Богам", () => {
  it("Тзинч, Cor 0 — доступно (порог снижен до 0), но без бонусных костей", async () => {
    const actor = actorWith({ cor: 0 });
    await spend(actor, "success", "tzeentch");
    expect(captured.warnings.length).toBe(0);
    expect(captured.chat.length).toBe(1);
    expect(captured.chat[0].content).toContain("+1 Успех к успешному тесту");
    expect(captured.rolls.length).toBe(0);
  });

  it("Тзинч, Cor 20 — бонусные кости 1d5 к Успеху", async () => {
    captured.nextRoll = 4;
    const actor = actorWith({ cor: 20 });
    await spend(actor, "success", "tzeentch");
    expect(captured.chat[0].content).toContain("Вспышка Гения");
    expect(captured.chat[0].content).toContain("+<b>4</b>");
  });

  it("Кхорн, Cor 0 — недоступно (обычный порог Cor 20 не снижен)", async () => {
    const actor = actorWith({ cor: 0 });
    await spend(actor, "success", "khorne");
    expect(captured.warnings.length).toBe(1);
    expect(captured.chat.length).toBe(0);
  });

  it("Кхорн, Cor 20 — обычный +1 Успех, без бонусных костей", async () => {
    const actor = actorWith({ cor: 20 });
    await spend(actor, "success", "khorne");
    expect(captured.chat[0].content).toContain("+1 Успех к успешному тесту");
    expect(captured.rolls.length).toBe(0);
  });

  it("Неделимый, Cor 20 — тот же обычный +1 Успех", async () => {
    const actor = actorWith({ cor: 20 });
    await spend(actor, "success", "undivided");
    expect(captured.chat[0].content).toContain("+1 Успех к успешному тесту");
  });
});

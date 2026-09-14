// test/combat/shield-vs-condition-tick.test.mjs
//
// Frozen Heart / Морозное Сердце (wdbc-5knb): книга (core.json) — «может
// бросаться против урона от Горения, гася персонажа при срабатывании».
// Конструктор kind:"shieldVsCondition" на предмете type:"forcefield",
// читается НАПРЯМУЮ combat/damage.mjs::rollShieldAgainstConditionTick, а не
// через ActiveEffect. Точка вызова — module/combat/condition-ticks.mjs,
// processConditionTurnEnd, ПЕРЕД обычным тиком Горения: тик состояния наносит
// урон в обход всего конвейера applyDamageToActor/_rollActiveShield, поэтому
// без этой отдельной точки входа щит вообще не участвует.
//
// Успех броска — Состояние снимается ЦЕЛИКОМ (conditionRemoveFields), а не
// поглощается только текущий тик. damageSubtype:"flame" даёт сработать тот же
// override рейтинга (kind:"shieldSubtype", 1-25 → 1-75 против E(Fl)), что и
// при обычном попадании — Морозное Сердце несёт обе записи на одном предмете.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach } from "vitest";
import { processConditionTurnEnd } from "../../module/combat/condition-ticks.mjs";

function shieldItem({
  currentRating = 25, overloadThreshold = 0, mechanics = [],
  overloadDamageFormula = "", overloadFatigueFormula = ""
} = {}) {
  return {
    id: "shield1", type: "forcefield",
    system: {
      equipped: true, status: "active", currentRating, overloadThreshold,
      shieldType: "deflector", shieldNature: "warp",
      overloadDamageFormula, overloadFatigueFormula, overloadRepairTest: ""
    },
    flags: { "warhammer-dbc": { mechanics } },
    getFlag(scope, key) { return this.flags?.[scope]?.[key]; },
    async update(data) {
      if (data["system.status"]        !== undefined) this.system.status        = data["system.status"];
      if (data["system.equipped"]      !== undefined) this.system.equipped      = data["system.equipped"];
      if (data["system.currentRating"] !== undefined) this.system.currentRating = data["system.currentRating"];
    }
  };
}

function makeActor(shield, overrides = {}) {
  const items = shield ? [shield] : [];
  const actor = {
    name: "Носитель Морозного Сердца",
    items: Object.assign([...items], { contents: items }),
    system: {
      characteristics: { t: { bonus: 0, total: 40 }, wp: { bonus: 0 } },
      fatigue: { value: 0 },
      wounds: { value: 10, max: 10, critical: 0, firstAidUsed: true },
      conditions: { burning: true, burningLevel: 1 },
      ...overrides
    },
    getFlag: () => undefined,
    setFlag: async () => {},
    async update(data) {
      for (const [path, value] of Object.entries(data)) {
        const parts = path.split(".");
        let target = actor;
        for (const part of parts.slice(0, -1)) target = (target[part] ??= {});
        target[parts.at(-1)] = value;
      }
      return data;
    }
  };
  return actor;
}

const vsBurning = [{
  id: "g1", operator: "AND",
  entries: [{ id: "e1", kind: "shieldVsCondition", shieldVsConditionKey: "burning" }]
}];

const vsBurningPlusOverride = [{
  id: "g1", operator: "AND",
  entries: [
    { id: "e1", kind: "shieldVsCondition", shieldVsConditionKey: "burning" },
    { id: "e2", kind: "shieldSubtype", shieldSubtypeMode: "override", shieldSubtypeKey: "flame", shieldSubtypeRatingMax: 75 }
  ]
}];

beforeEach(resetCaptured);

describe("kind:\"shieldVsCondition\" — Морозное Сердце против тика Горения", () => {
  it("без записи kind:\"shieldVsCondition\" — щит не рассматривается, Горение тикает как обычно", async () => {
    const actor = makeActor(shieldItem({ currentRating: 99, mechanics: [] }));
    captured.dice = [1, 5]; // 1 ≤ 99 блокировал бы, если бы щит катился; 5 — тик Горения
    await processConditionTurnEnd(actor);

    expect(actor.system.conditions.burning).toBe(true);       // Горение осталось
    expect(actor.system.wounds.value).toBeLessThan(10);        // тик всё же ударил
  });

  it("успешный бросок — Горение снимается ЦЕЛИКОМ, обычный тик не считается", async () => {
    const actor = makeActor(shieldItem({ currentRating: 25, mechanics: vsBurning }));
    captured.dice = [10]; // ≤ 25 — щит сработал; второго броска (тика) быть не должно
    await processConditionTurnEnd(actor);

    expect(actor.system.conditions.burning).toBe(false);
    expect(actor.system.conditions.burningLevel).toBe(0);
    expect(actor.system.wounds.value).toBe(10); // урон тика не применён вовсе
  });

  it("неудачный бросок — Горение остаётся, тик 1d10 считается как обычно", async () => {
    const actor = makeActor(shieldItem({ currentRating: 25, mechanics: vsBurning }));
    captured.dice = [50, 5]; // 50 > 25 — щит не сработал; 5 — обычный тик Горения
    await processConditionTurnEnd(actor);

    expect(actor.system.conditions.burning).toBe(true);
    expect(actor.system.wounds.value).toBeLessThan(10);
  });

  it("вместе с override kind:\"shieldSubtype\" — против тика используется рейтинг 1-75, не 1-25", async () => {
    const actor = makeActor(shieldItem({ currentRating: 25, mechanics: vsBurningPlusOverride }));
    captured.dice = [50]; // > 25 (обычный рейтинг), ≤ 75 (override против E(Fl))
    await processConditionTurnEnd(actor);

    expect(actor.system.conditions.burning).toBe(false); // потушено override-рейтингом
  });

  it("щит не активен (не equipped) — не рассматривается, тик идёт как обычно", async () => {
    const shield = shieldItem({ currentRating: 99, mechanics: vsBurning });
    shield.system.equipped = false;
    const actor = makeActor(shield);
    captured.dice = [1, 5];
    await processConditionTurnEnd(actor);

    expect(actor.system.conditions.burning).toBe(true);
    expect(actor.system.wounds.value).toBeLessThan(10);
  });

  it("перегрузка на тике Горения — щит выключается, доп. урон/усталость Морозного Сердца применяются", async () => {
    const actor = makeActor(shieldItem({
      currentRating: 25, overloadThreshold: 50, mechanics: vsBurning,
      overloadDamageFormula: "1d5", overloadFatigueFormula: "1d5-1"
    }));
    // rv=10: ≤25 (блокирован/потушено), ≤50 (перегрузка) → доп. броски урона (1d5) и усталости (1d5-1).
    captured.dice = [10, 4, 4];
    await processConditionTurnEnd(actor);

    expect(actor.system.conditions.burning).toBe(false);
    expect(actor.system.wounds.value).toBe(10 - 4); // сам тик отменён, но перегрузка бьёт напрямую
    expect(actor.system.fatigue.value).toBe(3);       // 4-1
  });
});

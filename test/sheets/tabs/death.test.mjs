// test/sheets/tabs/death.test.mjs
//
// module/sheets/tabs/death.mjs::_resolveFateSave — путь Eternal Warrior/
// Вечный Воин (wdbc-sk8s): free (раз за сессию, 0 стоимость) и flat
// (фиксированная 1 Очко Бесчестия, дальнобойная смерть, не трогает заряд
// сессии). Обычный (без Вечного Воина) путь уже покрыт
// test/documents/runic-weave-hooks.test.mjs — здесь только новые ветки.

import "../../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach } from "vitest";
import { doMiraculousSave, doDivineProtection, doSusAnimation } from "../../../module/sheets/tabs/death.mjs";
import { eternalWarriorFreeSaveAvailable } from "../../../module/combat/eternal-warrior.mjs";

// Заглушка foundry.utils.getProperty в стенде всегда отдаёт undefined (не
// нужна остальным тестам, см. test/apps/infamy-points-gods.test.mjs) —
// spendFromInfamyPool читает через неё текущий пул, поэтому здесь нужна
// настоящая реализация по пути через точку.
foundry.utils.getProperty = (object, key) =>
  String(key).split(".").reduce((o, k) => o?.[k], object);

function berserker({ fate = 30, corruption = 10 } = {}) {
  const flags = {};
  const updates = [];
  return {
    id: "a1", name: "Берсерк", type: "character",
    system: {
      alignment: "heretic", inRage: true,
      fate: { value: fate }, corruption: { value: corruption },
      wounds: { value: -3, critical: 3, max: 10 }
    },
    items: [{ type: "mutation", name: "Eternal Warrior / Вечный Воин" }],
    updates,
    getFlag: (scope, key) => flags[`${scope}.${key}`],
    async setFlag(scope, key, value) { flags[`${scope}.${key}`] = value; },
    async update(data) { updates.push(data); Object.assign(this.system, {
      ...(data["system.fate.value"] !== undefined ? { fate: { value: data["system.fate.value"] } } : {}),
      ...(data["system.corruption.value"] !== undefined ? { corruption: { value: data["system.corruption.value"] } } : {})
    }); }
  };
}

beforeEach(resetCaptured);

describe("Eternal Warrior — путь free", () => {
  it("0 стоимость пула, Порча не растёт, отмечает разовый заряд сессии", async () => {
    const actor = berserker({ fate: 30, corruption: 10 });
    expect(eternalWarriorFreeSaveAvailable(actor)).toBe(true);
    await doMiraculousSave(actor, { eternalWarrior: "free" });

    expect(captured.rolls).toEqual([]); // никаких костей — путь бесплатный
    const upd = actor.updates.at(-1);
    expect(upd["system.fate.value"]).toBe(30); // не потрачено
    expect(upd["system.corruption.value"]).toBe(10); // не выросла
    expect(eternalWarriorFreeSaveAvailable(actor)).toBe(false); // заряд сессии сгорел
  });
});

describe("Eternal Warrior — путь flat", () => {
  it("фиксированная 1 Очко Бесчестия, Порча не растёт, заряд сессии не трогает", async () => {
    const actor = berserker({ fate: 30, corruption: 10 });
    await doDivineProtection(actor, { eternalWarrior: "flat" });

    expect(captured.rolls).toEqual([]);
    const upd = actor.updates.at(-1);
    expect(upd["system.fate.value"]).toBe(29); // 30 − 1
    expect(upd["system.corruption.value"]).toBe(10);
    expect(eternalWarriorFreeSaveAvailable(actor)).toBe(true); // заряд сессии остался цел
  });

  it("недостаточно пула (fate=0) — провал, как у обычного Спасения", async () => {
    const actor = berserker({ fate: 0, corruption: 10 });
    await doMiraculousSave(actor, { eternalWarrior: "flat" });
    expect(captured.chat.at(-1).content).toContain("Провал");
  });
});

function astartesForSusAn({ wp = 40 } = {}) {
  const flags = {};
  const updates = [];
  const actor = {
    id: "a2", name: "Дредноут", type: "character",
    system: { characteristics: { wp: { total: wp } } },
    updates,
    getFlag: (scope, key) => flags[`${scope}.${key}`],
    async setFlag(scope, key, value) { flags[`${scope}.${key}`] = value; },
    async update(data) { updates.push(data); }
  };
  return actor;
}

// Без сознания (стр. 30-31, wdbc-r5o7.7): Замедленная Анимация раньше сама
// выставляла И unconscious, И helpless — дублирование двух флагов вручную.
// Теперь Беспомощность — производное поле (rules/character.mjs, derived
// data), отдельно её здесь ставить не нужно и не должно.
describe("doSusAnimation (Замедленная Анимация, wdbc-r5o7.7)", () => {
  it("успех — ставит unconscious, НЕ ставит helpless напрямую (она производная)", async () => {
    const actor = astartesForSusAn({ wp: 40 });
    captured.dice = [50]; // W 40 + 30 = 70 порог, 50 <= 70 → успех
    await doSusAnimation(actor);

    const upd = actor.updates[0];
    expect(upd["system.conditions.unconscious"]).toBe(true);
    expect(upd).not.toHaveProperty("system.conditions.helpless");
    expect(captured.chat.at(-1).content).toContain("Успех");
  });

  it("провал — ничего не ставит", async () => {
    const actor = astartesForSusAn({ wp: 10 });
    captured.dice = [90]; // W 10 + 30 = 40 порог, 90 > 40 → провал
    await doSusAnimation(actor);

    expect(actor.updates).toHaveLength(0);
    expect(captured.chat.at(-1).content).toContain("Провал");
  });
});

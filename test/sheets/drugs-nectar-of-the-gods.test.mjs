// test/sheets/drugs-nectar-of-the-gods.test.mjs
//
// Нектар Богов (Талант Шумового Десантника, Sahara 1-54b9) в sheets/tabs/drugs.mjs:
//   «Он иммунен к пост-эффектам наркотиков. При принятии любого наркотика он сразу получает зависимость
//   от него и теряет зависимость от всех других наркотиков.»
// Иммунитет к пост-эффектам НЕ даёт иммунитета к зависимости (в отличие от Владыки Праздности).

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach } from "vitest";
import { triggerAfterEffect, weeklyDoseCheck } from "../../module/sheets/tabs/drugs.mjs";

const NS = "warhammer-dbc";
const NECTAR = { type: "talent", name: "Nectar Of The Gods / Нектар Богов", system: {}, flags: {}, getFlag: () => undefined };

function actorOf(items = [], flags = {}) {
  const store = { ...flags };
  const a = {
    id: "A1", name: "Шумовой", uuid: "Actor.A1", type: "character", items, isOwner: true,
    system: { conditions: {}, characteristics: { t: { total: 40, bonus: 4 }, wp: { total: 40, bonus: 4 } }, fatigue: { value: 0, max: 8 } },
    getFlag: (scope, key) => store[`${scope}.${key}`],
    setFlag: async (scope, key, v) => { store[`${scope}.${key}`] = { ...(store[`${scope}.${key}`] ?? {}), ...v }; },
    unsetFlag: async () => {},
    update: async changes => {
      for (const [path, v] of Object.entries(changes)) {
        const m = path.match(/^flags\.([^.]+)\.(.+)$/);
        if (m) { store[`${m[1]}.${m[2]}`] = v; continue; }
        const keys = path.split(".").slice(1);
        let node = a.system;
        for (const k of keys.slice(0, -1)) node = (node[k] ??= {});
        node[keys.at(-1)] = v;
      }
    },
    getActiveTokens: () => [],
    _store: store
  };
  return a;
}

const narcotic = (name, extra = {}) => ({
  name, type: "drug", updates: [], update: async function (u) { this.updates.push(u); },
  system: { quantity: 3, drugCategory: "narcotic", specialEffects: {}, activeEffect: { isActive: true },
    addiction: { hasAddiction: true, minDose: 99, frequency: "12 часов", testChar: "t" }, ...extra }
});

beforeEach(() => { resetCaptured(); });

describe("Нектар Богов: пост-эффект", () => {
  it("с Талантом пост-эффект не наступает — действие просто кончается", async () => {
    const a = actorOf([NECTAR]);
    const item = narcotic("Рекаф", { hasAfterEffect: true, afterEffectSpecial: { grantsCondition: "fatigued" } });
    await triggerAfterEffect(a, item);
    expect(item.updates.at(-1)).toMatchObject({ "system.activeEffect.isActive": false, "system.activeEffect.isAfterEffect": false });
    expect(captured.chat.at(-1).content).toContain("Нектар Богов");
  });
});

describe("Нектар Богов: доза", () => {
  it("weeklyDoseCheck сразу делает носителя зависимым от принятого и снимает зависимость от прежнего", async () => {
    const a = actorOf([NECTAR], { [`${NS}.drugWithdrawal`]: { "Тиск": { addicted: true, name: "Тиск", lastDose: 0, doneTo: 0, tested: 0, addiction: {} } } });
    await weeklyDoseCheck(a, narcotic("Рекаф"));
    const entries = a._store[`${NS}.drugWithdrawal`];
    expect(entries["Рекаф"].addicted).toBe(true);
    expect(entries["Тиск"] ?? null).toBeNull();
    expect(a.system.conditions.addicted).toBe(true);
  });

  it("без Таланта доза зависимости сама не даёт", async () => {
    const a = actorOf([]);
    await weeklyDoseCheck(a, narcotic("Рекаф"));
    expect(a._store[`${NS}.drugWithdrawal`]).toBeUndefined();
  });
});

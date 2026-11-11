// test/sheets/drugs-poison-elixir.test.mjs
// wdbc-x1nz.4 («Арсенал» → «Химия», сверка с книгой):
//   • «Яды» — спасбросок ЦЕЛИ против яда (characteristics из poisonTestChar/
//     poisonTestMod предмета + модификатор Качества, rules/poison-resist.mjs);
//   • «Эликсиры» — не действуют на цель с суммарным встречным бонусом ≥ +20
//     на тесты против психосил, кроме как от Таланта Bastion of Iron Will
//     (его носитель обходит проверку целиком).
// Подставные предметы/акторы — тот же приём, что test/sheets/drugs.test.mjs.

import "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { applyDrug } from "../../module/sheets/tabs/drugs.mjs";

function drug({ id = "drug-1", name = "Препарат", system = {} } = {}) {
  const item = {
    id, name, type: "drug", system,
    update: async data => {
      for (const [path, value] of Object.entries(data)) {
        const parts = path.split(".");
        let t = item;
        for (const p of parts.slice(0, -1)) t = (t[p] ??= {});
        t[parts.at(-1)] = value;
      }
      return data;
    },
    toObject: () => ({ _id: id, name: item.name, type: item.type, system: structuredClone(item.system) })
  };
  return item;
}

/** Предмет с записью Конструктора testMod — та же форма, что реальные записи (test/apps/armour-history.test.mjs). */
function testModItem({ id = "bonus-1", name = "Бонус", modScope, value, type = "talent" } = {}) {
  return {
    id, name, type, system: {},
    flags: { "warhammer-dbc": { mechanics: [{
      id: "grp1", operator: "AND",
      entries: [{ id: "e1", kind: "testMod", modScope, modValueMode: "flat", value, label: name,
        when: { negate: false, conditions: [] } }]
    }] } }
  };
}

/** Талант «Bastion of Iron Will» по имени — как он лежит в паке (английская половина). */
function bastionTalent() {
  return { id: "bastion-1", name: "Bastion of Iron Will / Бастион Железной Воли", type: "talent", system: {}, flags: {} };
}

function actor({ items = [], t = 40, wp = 35 } = {}) {
  const list = [...items];
  list.get = id => list.find(i => i.id === id) ?? null;
  const a = {
    name: "Подставной", items: list,
    system: {
      fatigue: { value: 0 }, conditions: {},
      wounds: { value: 10, max: 10, critical: 0 },
      characteristics: {
        t: { total: t, bonus: Math.floor(t / 10) },
        wp: { total: wp, bonus: Math.floor(wp / 10) },
        int: { total: 40, value: 40, bonus: 4 }
      },
      corruptionBonus: 0
    },
    getFlag: () => undefined,
    update: async data => {
      for (const [path, value] of Object.entries(data)) {
        const parts = path.split(".");
        let t2 = a;
        for (const p of parts.slice(0, -1)) t2 = (t2[p] ??= {});
        t2[parts.at(-1)] = value;
      }
      return data;
    }
  };
  return a;
}

beforeEach(resetCaptured);
beforeEach(() => { game.time = { worldTime: 123 }; });

describe("Яды: спасбросок цели (rollPoisonResistTest через applyDrug)", () => {
  it("применение яда бросает отдельную карточку спасброска цели с модификатором Качества", async () => {
    const item = drug({ system: {
      quantity: 1, drugCategory: "poison", quality: "good",
      poisonTestChar: "t", poisonTestMod: 10,
      specialEffects: {}, activeEffect: {}
    } });
    const a = actor({ items: [item], t: 40 });
    captured.dice = [50, 30]; // первый — длительность(нет), второй — спасбросок
    captured.nextRoll = 30;

    await applyDrug(a, item);

    // Карточка применения + карточка спасброска.
    expect(captured.chat.length).toBeGreaterThanOrEqual(2);
    const resistCard = captured.chat.find(c => c.content.includes("Спасбросок против яда"));
    expect(resistCard).toBeTruthy();
    // Порог = T 40 + poisonTestMod 10 + Good.Q (−10) = 40.
    expect(resistCard.content).toContain("<label>Порог</label><b>40</b>");
  });

  it("Poor.Q облегчает Порог спасброска цели (+10)", async () => {
    const item = drug({ system: {
      quantity: 1, drugCategory: "poison", quality: "poor",
      poisonTestChar: "t", poisonTestMod: 0,
      specialEffects: {}, activeEffect: {}
    } });
    const a = actor({ items: [item], t: 40 });
    captured.nextRoll = 30;

    await applyDrug(a, item);

    const resistCard = captured.chat.find(c => c.content.includes("Спасбросок против яда"));
    // Порог = T 40 + 0 + Poor.Q (+10) = 50.
    expect(resistCard.content).toContain("<label>Порог</label><b>50</b>");
  });

  it("медикамент (не яд) — без карточки спасброска", async () => {
    const item = drug({ system: {
      quantity: 1, drugCategory: "medicine", specialEffects: {}, activeEffect: {}
    } });
    const a = actor({ items: [item] });

    await applyDrug(a, item);

    expect(captured.chat.some(c => c.content.includes("Спасбросок против яда"))).toBe(false);
  });
});

describe("Эликсиры: иммунитет к психосилам / встречный бонус ≥ +20", () => {
  it("суммарный бонус ≥ +20 против психосил — эликсир не действует, доза потрачена", async () => {
    const bonus = testModItem({ modScope: "psychicPower", value: 20 });
    const item = drug({ system: {
      quantity: 2, drugCategory: "elixir",
      specialEffects: { removesWounds: 5 }, activeEffect: {}
    } });
    const a = actor({ items: [item, bonus] });
    a.system.wounds = { value: 1, max: 10, critical: 0 };

    await applyDrug(a, item);

    // Доза потрачена, лечение НЕ применилось.
    expect(item.updates ?? item.system.quantity).toBe(1);
    expect(a.system.wounds.value).toBe(1);
    expect(captured.chat[0].content).toContain("не действует");
  });

  it("бонус < +20 — эликсир действует как обычно", async () => {
    const bonus = testModItem({ modScope: "psychicPower", value: 15 });
    const item = drug({ system: {
      quantity: 2, drugCategory: "elixir",
      specialEffects: { removesWounds: 5 }, activeEffect: {}
    } });
    const a = actor({ items: [item, bonus] });
    a.system.wounds = { value: 1, max: 10, critical: 0 };

    await applyDrug(a, item);

    expect(a.system.wounds.value).toBe(6);
  });

  it("бонус ≥ +20 от самого Bastion of Iron Will — Талант есть, проверка обходится целиком", async () => {
    const bonus = testModItem({ modScope: "psychicPower", value: 20, id: "bastion-bonus" });
    const bastion = bastionTalent();
    const item = drug({ system: {
      quantity: 2, drugCategory: "elixir",
      specialEffects: { removesWounds: 5 }, activeEffect: {}
    } });
    const a = actor({ items: [item, bonus, bastion] });
    a.system.wounds = { value: 1, max: 10, critical: 0 };

    await applyDrug(a, item);

    expect(a.system.wounds.value).toBe(6);
  });

  it("яд (не эликсир) — проверка психосил не применяется вовсе", async () => {
    const bonus = testModItem({ modScope: "psychicPower", value: 99 });
    const item = drug({ system: {
      quantity: 1, drugCategory: "poison", specialEffects: { removesWounds: 5 }, activeEffect: {}
    } });
    const a = actor({ items: [item, bonus] });
    a.system.wounds = { value: 1, max: 10, critical: 0 };
    captured.nextRoll = 30;

    await applyDrug(a, item);

    expect(a.system.wounds.value).toBe(6);
  });
});

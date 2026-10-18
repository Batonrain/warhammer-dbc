// test/sheets/drugs-resilience.test.mjs
//
// Таланты Стойкости (глава 3) в препаратах:
//   Пожиратель Змей — урон Ранами от яда и срок яда/пост-эффекта вдвое (окр.▲);
//   Декаданс — +10 на тест Зависимости.
// Подставные предметы — как в test/sheets/drugs.test.mjs.

import "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { rollAddictionTest, applyEffectExtras, applyDrug, triggerAfterEffect } from "../../module/sheets/tabs/drugs.mjs";

const talent = (name, system = {}) => ({ id: name, type: "talent", name, system, flags: {} });

function drug(system) {
  const item = {
    id: "drug-1", name: "Препарат", type: "drug", system,
    update: async data => {
      for (const [path, value] of Object.entries(data)) {
        const parts = path.split(".");
        let t = item;
        for (const p of parts.slice(0, -1)) t = (t[p] ??= {});
        t[parts.at(-1)] = value;
      }
      return data;
    },
    toObject: () => ({ _id: "drug-1", name: item.name, type: item.type, system: structuredClone(item.system) })
  };
  return item;
}

function actor({ items = [], wounds = 10 } = {}) {
  const list = [...items];
  list.get = id => list.find(i => i.id === id) ?? null;
  const a = {
    name: "Подставной", items: list,
    system: {
      fatigue: { value: 0 }, conditions: {},
      wounds: { value: wounds, max: 20, critical: 0 },
      characteristics: {
        t: { total: 40, bonus: 4 }, wp: { total: 35, bonus: 3 }, int: { total: 40, value: 40, bonus: 4 }
      },
      corruptionBonus: 0
    },
    getFlag: () => undefined,
    update: async data => {
      for (const [path, value] of Object.entries(data)) {
        const parts = path.split(".");
        let t = a;
        for (const p of parts.slice(0, -1)) t = (t[p] ??= {});
        t[parts.at(-1)] = value;
      }
      return data;
    }
  };
  return a;
}

beforeEach(resetCaptured);
beforeEach(() => { game.time = { worldTime: 123 }; });

describe("Пожиратель Змей: урон яда в Раны", () => {
  const snake = [talent("Snake Eater / Пожиратель Змей")];

  it("урон яда вдвое меньше (окр.▲): 7 → 4, Раны 10 → 6", async () => {
    const a = actor({ items: snake });
    captured.nextRoll = 7;
    const res = await applyEffectExtras(a, { woundDamage: "1d10" }, { poisonSource: true });
    expect(res.updates["system.wounds.value"]).toBe(6);
    expect(res.lines.join("")).toContain("Пожиратель Змей");
  });

  it("не яд (poisonSource не задан) — урон полный", async () => {
    const a = actor({ items: snake });
    captured.nextRoll = 7;
    const res = await applyEffectExtras(a, { woundDamage: "1d10" });
    expect(res.updates["system.wounds.value"]).toBe(3);
  });

  it("без Таланта урон яда полный", async () => {
    const a = actor();
    captured.nextRoll = 7;
    const res = await applyEffectExtras(a, { woundDamage: "1d10" }, { poisonSource: true });
    expect(res.updates["system.wounds.value"]).toBe(3);
  });
});

describe("Пожиратель Змей: сроки", () => {
  const snake = [talent("Snake Eater / Пожиратель Змей")];
  const base = over => ({
    drugCategory: "poison", quantity: 1, duration: "1d10", hasAfterEffect: false,
    activeEffect: {}, ...over
  });

  it("срок яда вдвое меньше (окр.▲): 7 → 4", async () => {
    const a = actor({ items: snake });
    const item = drug(base());
    captured.nextRoll = 7;
    await applyDrug(a, item);
    expect(item.system.activeEffect.roundsRemaining).toBe(4);
    expect(captured.chat.at(-1).content).toContain("Пожиратель Змей");
  });

  it("срок наркотика (не яда) не меняется", async () => {
    const a = actor({ items: snake });
    const item = drug(base({ drugCategory: "narcotic" }));
    captured.nextRoll = 7;
    await applyDrug(a, item);
    expect(item.system.activeEffect.roundsRemaining).toBe(7);
  });

  it("срок яда без Таланта не меняется", async () => {
    const a = actor();
    const item = drug(base());
    captured.nextRoll = 7;
    await applyDrug(a, item);
    expect(item.system.activeEffect.roundsRemaining).toBe(7);
  });

  it("пост-эффект: бросок «Кубы пост-эффекта» вдвое меньше (окр.▲)", async () => {
    const a = actor({ items: snake });
    const item = drug(base({ drugCategory: "narcotic", hasAfterEffect: true, afterEffect: "Ломка", afterEffectDice: "1d10" }));
    captured.nextRoll = 7;
    await triggerAfterEffect(a, item);
    const card = captured.chat.at(-1).content;
    expect(card).toContain("Пожиратель Змей: вдвое (окр.▲) = ");
    expect(card).toContain(">4<");
  });

  it("пост-эффект без Таланта — бросок как есть", async () => {
    const a = actor();
    const item = drug(base({ drugCategory: "narcotic", hasAfterEffect: true, afterEffect: "Ломка", afterEffectDice: "1d10" }));
    captured.nextRoll = 7;
    await triggerAfterEffect(a, item);
    expect(captured.chat.at(-1).content).not.toContain("Пожиратель Змей");
  });
});

describe("Декаданс: тест Зависимости", () => {
  it("Порог теста Зависимости +10 у носителя", async () => {
    const item = drug({ addiction: { hasAddiction: true, isAddicted: false } });
    const a = actor({ items: [talent("Decadence / Декаданс"), item] });
    captured.nextRoll = 50;
    await rollAddictionTest(a, item, "t", 0);
    expect(captured.chat.at(-1).content).toContain("<label>Порог</label><b>50</b>");   // 40 + 10
  });

  it("без Таланта Порог обычный", async () => {
    const item = drug({ addiction: { hasAddiction: true, isAddicted: false } });
    const a = actor({ items: [item] });
    captured.nextRoll = 50;
    await rollAddictionTest(a, item, "t", 0);
    expect(captured.chat.at(-1).content).toContain("<label>Порог</label><b>40</b>");
  });
});

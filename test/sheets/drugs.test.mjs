import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { rollAddictionTest, applyEffectExtras } from "../../module/sheets/tabs/drugs.mjs";
import { computeWoundHealing, computeWoundDamage } from "../../module/sheets/tabs/wounds.mjs";

function drug({ id = "drug-1", addicted = false } = {}) {
  const updates = [];
  const item = {
    id,
    name: "Пыльца",
    type: "drug",
    updates,
    system: { addiction: { hasAddiction: true, isAddicted: addicted } },
    update: async data => {
      updates.push(data);
      for (const [path, value] of Object.entries(data)) {
        const parts = path.split(".");
        let target = item;
        for (const part of parts.slice(0, -1)) {
          target[part] ??= {};
          target = target[part];
        }
        target[parts.at(-1)] = value;
      }
      return data;
    }
  };
  return item;
}

function actor({ items = [], fatigue = 0, t = 40, wp = 35 } = {}) {
  const updates = [];
  const list = [...items];
  const a = {
    name: "Подставной",
    updates,
    items: list,
    system: {
      fatigue: { value: fatigue },
      conditions: {},
      characteristics: {
        t: { total: t, bonus: Math.floor(t / 10) },
        wp: { total: wp, bonus: Math.floor(wp / 10) }
      }
    },
    update: async data => {
      updates.push(data);
      for (const [path, value] of Object.entries(data)) {
        const parts = path.split(".");
        let target = a;
        for (const part of parts.slice(0, -1)) {
          target[part] ??= {};
          target = target[part];
        }
        target[parts.at(-1)] = value;
      }
      return data;
    }
  };
  return a;
}

beforeEach(resetCaptured);

describe("drug addiction test", () => {
  it("провал ставит зависимость на препарат и состояние на актора", async () => {
    const item = drug();
    const a = actor({ items: [item], fatigue: 1, t: 40 });
    captured.nextRoll = 50;

    await rollAddictionTest(a, item, "wp", 0);

    expect(item.updates[0]).toEqual({ "system.addiction.isAddicted": true });
    expect(a.updates[0]).toEqual({ "system.conditions.addicted": true });
    expect(captured.chat[0].content).toContain("Порог: <b>25</b>");
    expect(captured.chat[0].content).toContain("Персонаж стал зависим");
  });

  it("успех снимает общее состояние, если других зависимостей нет", async () => {
    const item = drug({ addicted: true });
    const a = actor({ items: [item], t: 40 });
    captured.nextRoll = 20;

    await rollAddictionTest(a, item, "t", 0);

    expect(item.updates[0]).toEqual({ "system.addiction.isAddicted": false });
    expect(a.updates[0]).toEqual({ "system.conditions.addicted": false });
    expect(captured.chat[0].content).toContain("Зависимость преодолена");
  });

  it("успех не снимает общее состояние, если есть другая активная зависимость", async () => {
    const item = drug({ id: "drug-1", addicted: true });
    const other = drug({ id: "drug-2", addicted: true });
    const a = actor({ items: [item, other], t: 40 });
    captured.nextRoll = 20;

    await rollAddictionTest(a, item, "t", 0);

    expect(item.updates[0]).toEqual({ "system.addiction.isAddicted": false });
    expect(a.updates).toEqual([]);
  });
});

describe("drug special effects", () => {
  it("computeWoundHealing сначала снимает критический урон, потом лечит Раны", () => {
    expect(computeWoundHealing({
      wounds: { value: 4, max: 10, critical: 3 }
    }, 5)).toEqual({
      "system.wounds.value": 6,
      "system.wounds.critical": 0
    });
  });

  it("computeWoundDamage переносит переполнение в критический урон и сбрасывает First Aid", () => {
    expect(computeWoundDamage({
      wounds: { value: 2, max: 10, critical: 1, firstAidUsed: true }
    }, 5)).toEqual({
      "system.wounds.value": 0,
      "system.wounds.critical": 4,
      "system.wounds.firstAidUsed": false
    });
  });

  it("applyEffectExtras собирает апдейты, строки чата и броски", async () => {
    const a = actor({ fatigue: 1, t: 40 });
    a.system.conditions = { haemorrhaging: true, haemorrhagingLevel: 3 };
    a.system.wounds = { value: 5, max: 10, critical: 0, firstAidUsed: true };
    captured.nextRoll = 2;

    const result = await applyEffectExtras(a, {
      removesHaemorrhagingLevels: 2,
      grantsFatigue: 1,
      healFormula: "1d5",
      woundDamage: "1d5"
    });

    expect(result.updates).toMatchObject({
      "system.conditions.haemorrhagingLevel": 1,
      "system.conditions.haemorrhaging": true,
      "system.fatigue.value": 2,
      "system.wounds.value": 3,
      "system.wounds.critical": 0,
      "system.wounds.firstAidUsed": false
    });
    expect(result.rolls).toHaveLength(2);
    expect(result.lines.join("\n")).toContain("Обескровливания");
  });
});

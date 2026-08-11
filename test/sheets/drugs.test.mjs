import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { rollAddictionTest } from "../../module/sheets/tabs/drugs.mjs";

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

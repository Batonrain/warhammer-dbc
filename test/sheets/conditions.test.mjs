import { describe, it, expect, beforeEach } from "vitest";
import { captured, fakeHtml, resetCaptured } from "../support/foundry-stub.mjs";
import { addFatigue, removeFatigue, fatigueSleep,
         showAddConditionDialog } from "../../module/sheets/tabs/conditions.mjs";

function makeActor(options = {}) {
  const updates = [];
  const a = {
    name: "Подставной",
    updates,
    system: {
      fatigue: { value: options.fatigue ?? 0, max: 0 },
      conditions: { unconscious: !!options.unconscious },
      characteristics: {
        t: { bonus: options.tBonus ?? 4 },
        wp: { bonus: options.wpBonus ?? 3 }
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

describe("fatigue controls", () => {
  it("addFatigue пишет новый уровень и порог T.b + W.b", async () => {
    const a = makeActor({ fatigue: 0, tBonus: 4, wpBonus: 3 });
    await addFatigue(a, 1);

    expect(a.updates[0]).toMatchObject({
      "system.fatigue.value": 1,
      "system.fatigue.max": 7
    });
    expect(captured.chat).toEqual([]);
  });

  it("addFatigue включает unconscious на пороге", async () => {
    const a = makeActor({ fatigue: 6, tBonus: 4, wpBonus: 3 });
    await addFatigue(a, 1);

    expect(a.updates[0]).toMatchObject({
      "system.fatigue.value": 7,
      "system.fatigue.max": 7,
      "system.conditions.unconscious": true
    });
    expect(captured.chat[0].content).toContain("Потеря сознания");
  });

  it("removeFatigue снимает unconscious, когда усталость ниже порога", async () => {
    const a = makeActor({ fatigue: 7, unconscious: true, tBonus: 4, wpBonus: 3 });
    await removeFatigue(a, 1);

    expect(a.updates[0]).toMatchObject({
      "system.fatigue.value": 6,
      "system.fatigue.max": 7,
      "system.conditions.unconscious": false
    });
  });

  it("fatigueSleep сбрасывает усталость и unconscious", async () => {
    const a = makeActor({ fatigue: 3, unconscious: true, tBonus: 5, wpBonus: 4 });
    await fatigueSleep(a);

    expect(a.updates[0]).toMatchObject({
      "system.fatigue.value": 0,
      "system.fatigue.max": 9,
      "system.conditions.unconscious": false
    });
    expect(captured.chat[0].content).toContain("Полноценный сон");
  });
});

describe("showAddConditionDialog", () => {
  it("добавляет выбранные состояния через callback диалога", async () => {
    const a = makeActor();
    showAddConditionDialog(a);

    await captured.dialog.buttons.add.callback(fakeHtml({}, {
      ".add-cond-cb:checked": [{ dataset: { condition: "stunned" } }]
    }));

    expect(a.updates[0]).toEqual({ "system.conditions.stunned": true });
  });
});

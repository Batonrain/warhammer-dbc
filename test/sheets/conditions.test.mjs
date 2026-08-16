import { describe, it, expect, beforeEach } from "vitest";
import { captured, fakeForm, listenerRoot, resetCaptured } from "../support/foundry-stub.mjs";
import { activateConditionsListeners, addFatigue, removeCondition, removeFatigue,
         fatigueSleep, setConditionLevel, fatiguePenalty,
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

describe("fatiguePenalty", () => {
  /** Предмет с записью Конструктора «Усталость: порог штрафа». */
  const graceItem = char => ({
    getFlag: (scope, key) => (scope === "warhammer-dbc" && key === "mechanics"
      ? [{ id: "g", operator: "AND", entries: [{
          id: "e", kind: "fatigue", fatigueAction: "threshold", fatigueThresholdChar: char }] }]
      : undefined)
  });

  it("без предметов штраф начинается с первой единицы Усталости", () => {
    expect(fatiguePenalty(makeActor({ fatigue: 0 }), "ws")).toBe(0);
    expect(fatiguePenalty(makeActor({ fatigue: 1 }), "ws")).toBe(-10);
  });

  it("запись Конструктора поднимает порог до Бонуса характеристики", () => {
    const a = makeActor({ fatigue: 4, tBonus: 4 });
    a.items = [graceItem("t")];
    // Порог стал 1 + 4: на четвёртой единице штрафа ещё нет.
    expect(fatiguePenalty(a, "ws")).toBe(0);
    a.system.fatigue.value = 5;
    expect(fatiguePenalty(a, "ws")).toBe(-10);
  });

  it("Стойкость от Усталости не страдает в любом случае", () => {
    expect(fatiguePenalty(makeActor({ fatigue: 9 }), "t")).toBe(0);
  });
});

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

    await captured.press("add", fakeForm({}, {
      ".add-cond-cb:checked": [{ dataset: { condition: "stunned" } }]
    }));

    expect(a.updates[0]).toEqual({ "system.conditions.stunned": true });
  });
});

describe("condition rows", () => {
  it("removeCondition обнуляет счётчик у состояния с уровнем", async () => {
    const a = makeActor();

    await removeCondition(a, "bleeding");

    expect(a.updates[0]).toEqual({
      "system.conditions.bleeding": false,
      "system.conditions.bleedingLevel": 0
    });
  });

  it("removeCondition у состояния без уровня пишет только флаг", async () => {
    const a = makeActor();

    await removeCondition(a, "prone");

    expect(a.updates[0]).toEqual({ "system.conditions.prone": false });
  });

  it("setConditionLevel пишет уровень и молчит для состояний без счётчика", async () => {
    const a = makeActor();

    await setConditionLevel(a, "stunned", "3");
    await setConditionLevel(a, "stunned", "мусор");
    await setConditionLevel(a, "prone", "2");

    expect(a.updates).toEqual([
      { "system.conditions.stunnedRounds": 3 },
      { "system.conditions.stunnedRounds": 0 }
    ]);
  });
});

describe("activateConditionsListeners", () => {
  function wire(actor) {
    const root = listenerRoot();
    activateConditionsListeners(root, actor);
    return root.handlers;
  }

  const ev = (dataset = {}, value) => ({
    preventDefault: () => {},
    stopPropagation: () => {},
    currentTarget: { dataset, value }
  });

  it("кнопки Усталости считают от текущего уровня", async () => {
    const a = makeActor({ fatigue: 2, tBonus: 4, wpBonus: 3 });
    const handlers = wire(a);

    await handlers[".fatigue-add-btn:click"](ev());
    expect(a.system.fatigue.value).toBe(3);

    await handlers[".fatigue-remove-btn:click"](ev());
    expect(a.system.fatigue.value).toBe(2);

    await handlers[".fatigue-rest-btn:click"](ev());
    expect(a.system.fatigue.value).toBe(1);

    await handlers[".fatigue-sleep-btn:click"](ev());
    expect(a.system.fatigue.value).toBe(0);
  });

  it("крестик снимает состояние, поле уровня его записывает", async () => {
    const a = makeActor();
    const handlers = wire(a);

    await handlers[".condition-remove-btn:click"](ev({ condition: "burning" }));
    await handlers[".condition-level-input:change"](ev({ condition: "burning" }, "2"));

    expect(a.updates).toEqual([
      { "system.conditions.burning": false, "system.conditions.burningLevel": 0 },
      { "system.conditions.burningLevel": 2 }
    ]);
  });

  it("плюсик открывает диалог добавления состояний", () => {
    const handlers = wire(makeActor());

    handlers[".conditions-add-btn:click"](ev());

    expect(captured.dialog.window.title).toBe("Добавить состояние");
  });
});

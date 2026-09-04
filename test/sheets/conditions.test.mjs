import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { captured, fakeForm, listenerRoot, resetCaptured } from "../support/foundry-stub.mjs";
import { activateConditionsListeners, addFatigue, addCondition, removeCondition, removeFatigue,
         fatigueSleep, setConditionLevel, fatiguePenalty,
         conditionApplyFields, conditionRemoveFields, conditionAdjustFields,
         showAddConditionDialog } from "../../module/sheets/tabs/conditions.mjs";
import { clearRuleSources, registerRuleSource, getRuleSources } from "../../module/rules/sources.mjs";

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

  // Feels No Pain / Не Чувствует Боли (wdbc-1rno): «не получает штраф −10 от
  // Усталости» — полный иммунитет через живой capability-грант mutation.feelsNoPain.
  it("mutation.feelsNoPain — штраф не применяется вообще, при любой Усталости", () => {
    const a = makeActor({ fatigue: 9 });
    a.items = [{
      id: "mut1", name: "Feels No Pain / Не Чувствует Боли", type: "mutation",
      flags: { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND", entries: [
        { id: "e", kind: "capability", capabilityKey: "mutation.feelsNoPain", label: "" }
      ] }] } }
    }];
    expect(fatiguePenalty(a, "ws")).toBe(0);
  });

  // Desiccated / Иссушенный (wdbc-1rno): «Усталость накладывает штраф −20
  // вместо обычного −10» — то же самое ранее срабатывание, что и у Feels No
  // Pain, но удваивает штраф вместо иммунитета.
  it("mutation.desiccated — штраф −20 вместо −10", () => {
    const a = makeActor({ fatigue: 1 });
    a.items = [{
      id: "mut2", name: "Desiccated / Иссушенный", type: "mutation",
      flags: { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND", entries: [
        { id: "e", kind: "capability", capabilityKey: "mutation.desiccated", label: "" }
      ] }] } }
    }];
    expect(fatiguePenalty(a, "ws")).toBe(-20);
  });

  it("без Усталости даже с Desiccated — штрафа всё равно нет", () => {
    const a = makeActor({ fatigue: 0 });
    a.items = [{
      id: "mut2", name: "Desiccated / Иссушенный", type: "mutation",
      flags: { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND", entries: [
        { id: "e", kind: "capability", capabilityKey: "mutation.desiccated", label: "" }
      ] }] } }
    }];
    expect(fatiguePenalty(a, "ws")).toBe(0);
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

  describe("sarcophagus.immuneBleedingFatigue (wdbc-drn)", () => {
    const saved = getRuleSources();
    afterEach(() => {
      clearRuleSources();
      for (const [key, fn] of saved) registerRuleSource(key, fn);
    });

    it("пилот Саркофага не набирает Усталость ни от какого источника", async () => {
      clearRuleSources();
      registerRuleSource("test", () => [
        { id: "test.rule", when: {}, effects: [{ kind: "grantFlag", target: "sarcophagus.immuneBleedingFatigue" }] }
      ]);
      const a = makeActor({ fatigue: 0, tBonus: 4, wpBonus: 3 });
      await addFatigue(a, 1);

      expect(a.updates).toHaveLength(0);
      expect(a.system.fatigue.value).toBe(0);
    });

    it("без возможности — Усталость набирается как обычно", async () => {
      clearRuleSources();
      const a = makeActor({ fatigue: 0, tBonus: 4, wpBonus: 3 });
      await addFatigue(a, 1);

      expect(a.updates[0]).toMatchObject({ "system.fatigue.value": 1 });
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

  it("не предлагает «Усталость» — тег зеркалит fatigue.value, ручного добавления нет", () => {
    const a = makeActor();
    showAddConditionDialog(a);

    expect(captured.dialog.content).not.toContain('data-condition="fatigued"');
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

  it("removeCondition и setConditionLevel молчат для «Усталости» — правится только на ТЕЛЕ", async () => {
    const a = makeActor();

    await removeCondition(a, "fatigued");
    await setConditionLevel(a, "fatigued", "5");

    expect(a.updates).toEqual([]);
  });

  it("addCondition пишет флаг и, если дан level, счётчик — одним патчем", async () => {
    const a = makeActor();
    await addCondition(a, "bleeding", { level: 2 });
    expect(a.updates[0]).toEqual({ "system.conditions.bleeding": true, "system.conditions.bleedingLevel": 2 });

    await addCondition(a, "prone");
    expect(a.updates[1]).toEqual({ "system.conditions.prone": true });
  });
});

// wdbc-fejd: единая точка наложения/снятия — раньше 19+ мест сами собирали
// пару «флаг + счётчик» руками, каждое своим кодом. *Fields — те же патчи,
// что addCondition/removeCondition, но без записи (для слияния с другими
// полями actor.update в одном вызове — грапл, наркотики, лечение и т.п.).
describe("conditionApplyFields / conditionRemoveFields / conditionAdjustFields", () => {
  it("conditionApplyFields: без level трогает только флаг, даже у состояния со счётчиком", () => {
    expect(conditionApplyFields("bleeding")).toEqual({ "system.conditions.bleeding": true });
  });

  it("conditionApplyFields: с level пишет и счётчик", () => {
    expect(conditionApplyFields("stunned", 3)).toEqual({
      "system.conditions.stunned": true, "system.conditions.stunnedRounds": 3
    });
  });

  it("conditionApplyFields: level не действует на состояние без счётчика", () => {
    expect(conditionApplyFields("prone", 5)).toEqual({ "system.conditions.prone": true });
  });

  it("conditionApplyFields: «Усталость» и неизвестный ключ — пустой патч", () => {
    expect(conditionApplyFields("fatigued", 3)).toEqual({});
    expect(conditionApplyFields("no-such-key")).toEqual({});
  });

  it("conditionRemoveFields: флаг + счётчик обнулены у состояния с уровнем", () => {
    expect(conditionRemoveFields("burning")).toEqual({
      "system.conditions.burning": false, "system.conditions.burningLevel": 0
    });
  });

  it("conditionRemoveFields: только флаг у состояния без уровня", () => {
    expect(conditionRemoveFields("pinned")).toEqual({ "system.conditions.pinned": false });
  });

  it("conditionAdjustFields: положительная дельта поднимает счётчик и держит флаг true", () => {
    const a = makeActor();
    a.system.conditions.bleedingLevel = 1;
    expect(conditionAdjustFields(a, "bleeding", 1)).toEqual({
      "system.conditions.bleeding": true, "system.conditions.bleedingLevel": 2
    });
  });

  it("conditionAdjustFields: отрицательная дельта снимает флаг на нуле, не уходит в минус", () => {
    const a = makeActor();
    a.system.conditions.lostHandsCount = 1;
    expect(conditionAdjustFields(a, "lostHands", -5)).toEqual({
      "system.conditions.lostHands": false, "system.conditions.lostHandsCount": 0
    });
  });

  it("conditionAdjustFields: отрицательная дельта, флаг остаётся true, пока счётчик > 0", () => {
    const a = makeActor();
    a.system.conditions.haemorrhagingLevel = 3;
    expect(conditionAdjustFields(a, "haemorrhaging", -1)).toEqual({
      "system.conditions.haemorrhaging": true, "system.conditions.haemorrhagingLevel": 2
    });
  });

  it("conditionAdjustFields: состояние без счётчика — положительная дельта накладывает флаг", () => {
    expect(conditionAdjustFields(makeActor(), "poisoned", 1)).toEqual({ "system.conditions.poisoned": true });
  });

  it("conditionAdjustFields: состояние без счётчика — неположительная дельта ничего не пишет (снимать — conditionRemoveFields)", () => {
    expect(conditionAdjustFields(makeActor(), "poisoned", -1)).toEqual({});
    expect(conditionAdjustFields(makeActor(), "poisoned", 0)).toEqual({});
  });

  it("conditionAdjustFields: «Усталость» и неизвестный ключ — пустой патч", () => {
    expect(conditionAdjustFields(makeActor(), "fatigued", 1)).toEqual({});
    expect(conditionAdjustFields(makeActor(), "no-such-key", 1)).toEqual({});
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

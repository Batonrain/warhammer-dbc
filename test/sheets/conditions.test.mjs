import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { captured, fakeForm, listenerRoot, resetCaptured } from "../support/foundry-stub.mjs";
import { activateConditionsListeners, addFatigue, addCondition, removeCondition, removeFatigue,
         fatigueSleep, setConditionLevel, fatiguePenalty, setFatigue, fatiguePeriodRest,
         fatigueChangeFields, stumpTimerFields,
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
    // Горение (wdbc-3pv5) несёт ещё два бесхозных поля сверх общего
    // флаг+счётчик — burningSourceDamage/burningGraceRounds (Cooler/Морозное
    // Сердце), снятие Состояния обнуляет и их же.
    // + метка формулы урона погасшего пламени (BURNING_FORMULA_FLAG,
    // combat/condition-ticks.mjs) — следующее загорание начинается с нуля.
    expect(conditionRemoveFields("burning")).toEqual({
      "system.conditions.burning": false, "system.conditions.burningLevel": 0,
      "system.conditions.burningSourceDamage": 0, "system.conditions.burningGraceRounds": 0,
      "flags.warhammer-dbc.-=burningDamageFormula": null
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
      {
        "system.conditions.burning": false, "system.conditions.burningLevel": 0,
        "system.conditions.burningSourceDamage": 0, "system.conditions.burningGraceRounds": 0,
        "flags.warhammer-dbc.-=burningDamageFormula": null
      },
      { "system.conditions.burningLevel": 2 }
    ]);
  });

  it("плюсик открывает диалог добавления состояний", () => {
    const handlers = wire(makeActor());

    handlers[".conditions-add-btn:click"](ev());

    expect(captured.dialog.window.title).toBe("Добавить состояние");
  });

  // wdbc-x1nz.2.95 п.1: ручной ввод числа шёл отправкой формы мимо порога.
  it("ручной ввод Усталости на пороге роняет без сознания", async () => {
    const a = makeActor({ fatigue: 0, tBonus: 4, wpBonus: 3 });
    const handlers = wire(a);
    await handlers[".fatigue-value-input:change"](ev({}, "9"));
    expect(a.system.fatigue.value).toBe(9);
    expect(a.system.conditions.unconscious).toBe(true);
  });
});

// ── Сверка «Статусы» (wdbc-x1nz.2.95/.96/.97) ─────────────────────────────
describe("Усталость по книге («Раны и Урон» → «Статусы»)", () => {
  const savedTime = globalThis.game.time;
  const savedUser = globalThis.game.user;
  afterEach(() => { globalThis.game.time = savedTime; globalThis.game.user = savedUser; });

  // п.3: «кроме тестов T, Inf, и Cor» — было "cog" вместо "cor".
  it("штраф −10 не касается тестов T, Inf и Cor", () => {
    const a = makeActor({ fatigue: 2 });
    expect(fatiguePenalty(a, "cor")).toBe(0);
    expect(fatiguePenalty(a, "t")).toBe(0);
    expect(fatiguePenalty(a, "inf")).toBe(0);
    expect(fatiguePenalty(a, "ws")).toBe(-10);
  });

  // .96: «+1 Усталости, которую нельзя снять» — штраф при хранимой 0.
  it("Гангрена даёт штраф −10 при хранимой Усталости 0", () => {
    const a = makeActor({ fatigue: 0 });
    a.system.conditions.gangrene = true;
    expect(fatiguePenalty(a, "ws")).toBe(-10);
  });

  // .96: порог обморока — по действующей Усталости (хранимая + 1 Гангрены).
  it("Гангрена: хранимая 5 + 1 = 6 → +1 доводит до порога 7", async () => {
    const a = makeActor({ fatigue: 5, tBonus: 4, wpBonus: 3 });
    a.system.conditions.gangrene = true;
    await addFatigue(a, 1);
    expect(a.system.fatigue.value).toBe(6);
    expect(a.system.conditions.unconscious).toBe(true);
  });

  // п.3: таймер пробуждения 10−T.b минут, мин. 1.
  it("обморок заводит таймер пробуждения worldTime + (10−T.b) мин", async () => {
    globalThis.game.time = { worldTime: 5000 };
    const a = makeActor({ fatigue: 6, tBonus: 4, wpBonus: 3 });
    await addFatigue(a, 1);
    expect(a.system.conditions.fatigueFaintWakeAt).toBe(5000 + 6 * 60);
    expect(captured.chat[0].content).not.toContain("автоматически");
    expect(captured.chat[0].content).toContain("Очнётся");
  });

  it("T.b ≥ 10 — обморок минимум на 1 минуту", async () => {
    globalThis.game.time = { worldTime: 0 };
    const a = makeActor({ fatigue: 0, tBonus: 12, wpBonus: 3 });
    await addFatigue(a, 15);
    expect(a.system.conditions.fatigueFaintWakeAt).toBe(60);
  });

  // п.2: перескок порога (Вой Ужаса до 9 при пороге 7) — −1 будит по книге.
  it("−1 при перескоке порога будит и опускает до T.b+W.b−1", async () => {
    const a = makeActor({ fatigue: 9, unconscious: true, tBonus: 4, wpBonus: 3 });
    a.system.conditions.fatigueFaintWakeAt = 1234;
    await removeFatigue(a, 1);
    expect(a.system.fatigue.value).toBe(6);
    expect(a.system.conditions.unconscious).toBe(false);
    expect(a.system.conditions.fatigueFaintWakeAt).toBe(0);
  });

  it("крестик на Без сознания от Усталости — тоже приход в себя по книге", async () => {
    const a = makeActor({ fatigue: 9, unconscious: true, tBonus: 4, wpBonus: 3 });
    a.system.conditions.fatigueFaintWakeAt = 1234;
    await removeCondition(a, "unconscious");
    expect(a.system.fatigue.value).toBe(6);
    expect(a.system.conditions.unconscious).toBe(false);
  });

  // п.1: Саркофаг и для прямой установки значения.
  it("setFatigue: иммунитет Саркофага отбрасывает рост", async () => {
    const saved = getRuleSources();
    clearRuleSources();
    registerRuleSource("test", () => [
      { id: "test.rule", when: {}, effects: [{ kind: "grantFlag", target: "sarcophagus.immuneBleedingFatigue" }] }
    ]);
    try {
      const a = makeActor({ fatigue: 1 });
      await setFatigue(a, 9);
      expect(a.system.fatigue.value).toBe(1);
      await setFatigue(a, 0);
      expect(a.system.fatigue.value).toBe(0);
    } finally {
      clearRuleSources();
      for (const [key, fn] of saved) registerRuleSource(key, fn);
    }
  });

  it("fatigueChangeFields — чистый патч, актор не пишется", () => {
    const a = makeActor({ fatigue: 0, tBonus: 4, wpBonus: 3 });
    const res = fatigueChangeFields(a, 7);
    expect(res.fields).toMatchObject({ "system.fatigue.value": 7, "system.conditions.unconscious": true });
    expect(res.fainted).toEqual({ minutes: 6 });
    expect(a.updates).toEqual([]);
  });

  // п.4 + решение 2: отдых и сон двигают Календарь, но только у ГМа.
  it("Час отдыха у ГМа сдвигает Календарь на 1 ч.", async () => {
    const advanced = [];
    globalThis.game.time = { worldTime: 0, advance: async s => { advanced.push(s); } };
    globalThis.game.user = { isGM: true };
    const a = makeActor({ fatigue: 2 });
    await fatiguePeriodRest(a);
    expect(a.system.fatigue.value).toBe(1);
    expect(advanced).toEqual([3600]);
  });

  it("Час отдыха у игрока — Усталость снята, время не двигается, карточка зовёт ГМа", async () => {
    const advanced = [];
    globalThis.game.time = { worldTime: 0, advance: async s => { advanced.push(s); } };
    globalThis.game.user = { isGM: false };
    const a = makeActor({ fatigue: 2 });
    await fatiguePeriodRest(a);
    expect(a.system.fatigue.value).toBe(1);
    expect(advanced).toEqual([]);
    expect(captured.chat.at(-1).content).toContain("Время двигает ГМ");
  });

  it("Сон: человек — 8 ч., космодесантник — 3 ч.", async () => {
    const advanced = [];
    globalThis.game.time = { worldTime: 0, advance: async s => { advanced.push(s); } };
    globalThis.game.user = { isGM: true };
    await fatigueSleep(makeActor({ fatigue: 3 }));
    const marine = makeActor({ fatigue: 3 });
    marine.system.race = "astartes";
    await fatigueSleep(marine);
    expect(advanced).toEqual([8 * 3600, 3 * 3600]);
  });

  // wdbc-t3c3t.10: ГМ укладывает отряд — отдых идёт параллельно, Календарь
  // сдвигается один раз, а не на каждого персонажа.
  it("Сон отряда у ГМа сдвигает Календарь один раз; повторный отдых того же персонажа — снова", async () => {
    const advanced = [];
    const time = { worldTime: 1000, advance: async s => { advanced.push(s); time.worldTime += s; } };
    globalThis.game.time = time;
    globalThis.game.user = { isGM: true };
    const squad = [1, 2, 3].map(() => makeActor({ fatigue: 3 }));
    for (const a of squad) await fatigueSleep(a);
    expect(advanced).toEqual([8 * 3600]);
    expect(squad.every(a => a.system.fatigue.value === 0)).toBe(true);
    expect(captured.chat.at(-1).content).toContain("одновременно");
    // Тот же персонаж отдыхает следующий час — это уже новый час.
    const b = makeActor({ fatigue: 2 });
    await fatiguePeriodRest(b);
    await fatiguePeriodRest(b);
    expect(advanced).toEqual([8 * 3600, 3600, 3600]);
    // Новый сон (окно 8 ч) и 40 с авто-течения — сон другого всё ещё параллелен.
    await fatigueSleep(squad[1]);
    expect(advanced).toEqual([8 * 3600, 3600, 3600, 8 * 3600]);
    time.worldTime += 40;
    await fatigueSleep(makeActor({ fatigue: 1 }));
    expect(advanced).toEqual([8 * 3600, 3600, 3600, 8 * 3600]);
    // Время двинули руками на час — следующий сон отряда снова двигает Календарь.
    time.worldTime += 3600;
    await fatigueSleep(squad[0]);
    expect(advanced).toEqual([8 * 3600, 3600, 3600, 8 * 3600, 8 * 3600]);
  });

  it("Сон гасит таймер обморока до сдвига времени — Календарь не разбудит второй раз", async () => {
    globalThis.game.time = { worldTime: 0, advance: async () => {} };
    globalThis.game.user = { isGM: true };
    const a = makeActor({ fatigue: 7, unconscious: true, tBonus: 4, wpBonus: 3 });
    a.system.conditions.fatigueFaintWakeAt = 360;
    await fatigueSleep(a);
    expect(a.system.conditions.fatigueFaintWakeAt).toBe(0);
    expect(a.system.fatigue.value).toBe(0);
  });
});

describe("Потеря конечностей вручную (wdbc-x1nz.2.97 п.1)", () => {
  const savedTime = globalThis.game.time;
  afterEach(() => { globalThis.game.time = savedTime; });

  it("диалог: потеря кисти — счётчик 1, Кровотечение и таймер обрубка", async () => {
    globalThis.game.time = { worldTime: 1000 };
    const a = makeActor({ tBonus: 3 });
    showAddConditionDialog(a);
    await captured.press("add", fakeForm({}, {
      ".add-cond-cb:checked": [{ dataset: { condition: "lostHands" } }]
    }));
    expect(a.updates[0]).toMatchObject({
      "system.conditions.lostHands": true,
      "system.conditions.lostHandsCount": 1,
      "system.conditions.bleeding": true,
      "system.conditions.lostHandsGangreneAt": 1000 + 3 * 86400
    });
  });

  it("addCondition: потеря ноги — то же самое", async () => {
    globalThis.game.time = { worldTime: 0 };
    const a = makeActor({ tBonus: 2 });
    await addCondition(a, "lostLegs");
    expect(a.system.conditions.bleeding).toBe(true);
    expect(a.system.conditions.lostLegsGangreneAt).toBe(2 * 86400);
  });

  it("строка уровня: 1 → 2 глаза — новая потеря; 2 → 1 — нет", async () => {
    globalThis.game.time = { worldTime: 0 };
    const a = makeActor({ tBonus: 2 });
    a.system.conditions.lostEyes = true;
    a.system.conditions.lostEyesCount = 1;
    await setConditionLevel(a, "lostEyes", "2");
    expect(a.updates[0]).toMatchObject({ "system.conditions.lostEyesCount": 2, "system.conditions.bleeding": true });
    await setConditionLevel(a, "lostEyes", "1");
    expect(a.updates[1]).toEqual({ "system.conditions.lostEyesCount": 1 });
  });

  it("вторая потеря того же типа не переносит уже идущий, более ранний таймер", () => {
    globalThis.game.time = { worldTime: 5000 };
    const a = makeActor({ tBonus: 3 });
    a.system.conditions.lostArmsGangreneAt = 6000;
    expect(stumpTimerFields(a, "lostArms")).toEqual({ "system.conditions.lostArmsGangreneAt": 6000 });
  });

  it("не-конечность через диалог — без Кровотечения", async () => {
    const a = makeActor();
    await addCondition(a, "prone");
    expect(a.updates[0]).toEqual({ "system.conditions.prone": true });
  });
});

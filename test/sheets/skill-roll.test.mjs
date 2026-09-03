// Строки 10–11 таблицы сверки (docs/checks/stage-2.md) и фаза 4 конвейера:
// сложение галочек в диалоге, бонус снятого шлема, штраф Усталости и итоговый
// порог броска.
//
// Заглушка Foundry нужна дважды: лист наследует класс приложения при загрузке
// модуля, а диалог броска — это DialogV2, кнопку которого тест жмёт через
// captured.press. Сам расчёт порога заглушку не задействует.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { captured, resetCaptured, sheetOf, fakeForm, checkbox } from "../support/foundry-stub.mjs";

// Динамический импорт: глобали Foundry должны быть на месте раньше листа.
const { WarhammerCharacterSheet } = await import("../../module/sheets/actor-sheet.mjs");

const sheet = system => sheetOf(WarhammerCharacterSheet, {
  characteristics: { int: { total: 40 }, ag: { total: 35 }, fel: { total: 30 }, t: { total: 45, bonus: 4 } },
  fatigue: { value: 0 },
  ...system
});

/** Открыть диалог броска и нажать «Бросок» с заданными полями и галочками. */
async function pressRoll(system, fields = {}, checks = {}) {
  const promise = sheet(system)._showSkillRollDialog("Медицина", 45, "int", false, { skill: "medicae" });
  await captured.press("roll", fakeForm({
    "#skill-target": "45", "#skill-char-select": "int", "#skill-modifier": "0", ...fields
  }, checks));
  return promise;
}

beforeEach(resetCaptured);

describe("сложение галочек в диалоге броска", () => {
  it("ручной модификатор проходит как есть", async () => {
    expect(await pressRoll({}, { "#skill-modifier": "10" })).toMatchObject({ modifier: 10, target: 45 });
  });

  it("три источника складываются: Происхождение, предмет, правило", async () => {
    const { modifier } = await pressRoll({}, {}, {
      ".hw-mod:checked":   [checkbox(20)],
      ".item-mod:checked": [checkbox(5)],
      ".rule-mod:checked": [checkbox(10)]
    });
    expect(modifier).toBe(35);
  });

  it("«ополовинить штраф» ополовинивает отрицательный итог", async () => {
    const { modifier } = await pressRoll({}, { "#skill-modifier": "-20" },
      { ".hw-mod:checked": [checkbox(0, true)] });
    expect(modifier).toBe(-10);
  });

  it("«ополовинить штраф» не трогает плюс", async () => {
    const { modifier } = await pressRoll({}, { "#skill-modifier": "20" },
      { ".rule-mod:checked": [checkbox(0, true)] });
    expect(modifier).toBe(20);
  });

  it("ополовинивание округляется в пользу персонажа: −25 даёт −12", async () => {
    const { modifier } = await pressRoll({}, { "#skill-modifier": "-25" },
      { ".item-mod:checked": [checkbox(0, true)] });
    expect(modifier).toBe(-12);
  });

  it("галочка правила доходит от реестра до разметки диалога", async () => {
    const { registerRuleSource, clearRuleSources, getRuleSources } =
      await import("../../module/rules/sources.mjs");
    const saved = getRuleSources();
    clearRuleSources();
    registerRuleSource("test", () => [
      { id: "x", label: "Проверочное правило", effects: [{ kind: "rollBonus", target: "skill:medicae", value: 10 }] }
    ]);
    try {
      const { html, mods } = sheet({})._ruleRollModsHtml({ kind: "skill", skill: "medicae", char: "int" });
      expect(mods).toHaveLength(1);
      expect(html).toContain("rule-mod");
      expect(html).toContain("Проверочное правило");
      expect(html).toContain('data-value="10"');
    } finally {
      clearRuleSources();
      for (const [key, fn] of saved) registerRuleSource(key, fn);
    }
  });

  // wdbc-1rno: обычный тест Навыка раньше вообще не нёс targetActor — правила
  // вида «противник ПРОТИВ персонажа» (targetHasTrait, module/rules/
  // predicates.mjs — уже существовал, но был мёртв за пределами атак,
  // attack-dialog.mjs) не могли сработать. Теперь _showSkillRollDialog берёт
  // первый выбранный таргет сцены (game.user.targets), тем же приёмом.
  it("targetHasTrait доходит до галочки диалога, когда есть выбранный таргет", async () => {
    const { registerRuleSource, clearRuleSources, getRuleSources } =
      await import("../../module/rules/sources.mjs");
    const saved = getRuleSources();
    clearRuleSources();
    registerRuleSource("test", () => [
      { id: "x", label: "Синэстезия: цель", when: { targetHasTrait: "Synesthesia" },
        effects: [{ kind: "rollBonus", target: "skill:scrutiny", value: -20 }] }
    ]);
    const targetActor = { items: [{ type: "mutation", name: "Synesthesia" }] };
    globalThis.game.user = { ...globalThis.game.user, targets: new Set([{ actor: targetActor }]) };
    try {
      sheet({})._showSkillRollDialog("Проницательность", 45, "per", false, { skill: "scrutiny" });
      expect(captured.dialog.content).toContain('data-value="-20"');
    } finally {
      globalThis.game.user = { ...globalThis.game.user, targets: new Set() };
      clearRuleSources();
      for (const [key, fn] of saved) registerRuleSource(key, fn);
    }
  });

  it("без выбранного таргета та же галочка не появляется", async () => {
    const { registerRuleSource, clearRuleSources, getRuleSources } =
      await import("../../module/rules/sources.mjs");
    const saved = getRuleSources();
    clearRuleSources();
    registerRuleSource("test", () => [
      { id: "x", label: "Синэстезия: цель", when: { targetHasTrait: "Synesthesia" },
        effects: [{ kind: "rollBonus", target: "skill:scrutiny", value: -20 }] }
    ]);
    globalThis.game.user = { ...globalThis.game.user, targets: new Set() };
    try {
      sheet({})._showSkillRollDialog("Проницательность", 45, "per", false, { skill: "scrutiny" });
      expect(captured.dialog.content).not.toContain("Синэстезия: цель");
    } finally {
      clearRuleSources();
      for (const [key, fn] of saved) registerRuleSource(key, fn);
    }
  });
});

// Lord of the Exodites (wdbc-zepq): встречные Запугивание/Пытки — тесты
// Морали по книге. Диалог не знает заранее, встречным ли будет тест, поэтому
// область "morale" включается для любого броска этими двумя навыками.
describe("область Морали для Запугивания/Допроса (wdbc-zepq)", () => {
  it("правило с областью morale видно в диалоге Запугивания, но не Медицины", async () => {
    const { registerRuleSource, clearRuleSources, getRuleSources } =
      await import("../../module/rules/sources.mjs");
    const saved = getRuleSources();
    clearRuleSources();
    registerRuleSource("test", () => [
      { id: "x", label: "Аура Владыки", effects: [{ kind: "rollBonus", target: "morale", value: 30 }] }
    ]);
    try {
      sheet({})._showSkillRollDialog("Запугивание", 40, "wp", false, { skill: "intimidate" });
      expect(captured.dialog.content).toContain("Аура Владыки");

      sheet({})._showSkillRollDialog("Медицина", 45, "int", false, { skill: "medicae" });
      expect(captured.dialog.content).not.toContain("Аура Владыки");
    } finally {
      clearRuleSources();
      for (const [key, fn] of saved) registerRuleSource(key, fn);
    }
  });

  it("то же правило видно и для Допроса (interrogate)", async () => {
    const { registerRuleSource, clearRuleSources, getRuleSources } =
      await import("../../module/rules/sources.mjs");
    const saved = getRuleSources();
    clearRuleSources();
    registerRuleSource("test", () => [
      { id: "x", label: "Аура Владыки", effects: [{ kind: "rollBonus", target: "morale", value: 30 }] }
    ]);
    try {
      sheet({})._showSkillRollDialog("Допрос", 40, "int", false, { skill: "interrogate" });
      expect(captured.dialog.content).toContain("Аура Владыки");
    } finally {
      clearRuleSources();
      for (const [key, fn] of saved) registerRuleSource(key, fn);
    }
  });
});

describe("строка 10 сверки: снятый шлем Астартес", () => {
  it("+5 к тесту на основе Товарищества", () => {
    expect(sheet({ helmetlessActive: true })._getHelmetlessBonus("fel")).toBe(5);
  });

  it("на других характеристиках прибавки нет", () => {
    expect(sheet({ helmetlessActive: true })._getHelmetlessBonus("ws")).toBe(0);
  });

  it("шлем на месте — прибавки нет", () => {
    expect(sheet({ helmetlessActive: false })._getHelmetlessBonus("fel")).toBe(0);
  });
});

describe("строка 11 сверки: штраф Усталости", () => {
  const tired = (value, over = {}) => sheet({ fatigue: { value }, ...over });

  it("−10 при Усталости 1", () => {
    expect(tired(1)._getFatiguePenalty("ag")).toBe(-10);
  });

  it("без Усталости штрафа нет", () => {
    expect(tired(0)._getFatiguePenalty("ag")).toBe(0);
  });

  it("Стойкость, Влияние, Мышление и Фактор Прибыли не страдают", () => {
    for (const key of ["t", "inf", "cog", "pf"]) {
      expect(tired(3)._getFatiguePenalty(key), key).toBe(0);
    }
  });

  it("Добывающий мир отодвигает штраф на T.b Усталости", () => {
    // «Потом и кровью»: при бонусе Стойкости 4 штраф начинается с пятой Усталости.
    const mining = { items: [{ type: "homeworld", system: { key: "mining" } }] };
    expect(tired(4, mining)._getFatiguePenalty("ag")).toBe(0);
    expect(tired(5, mining)._getFatiguePenalty("ag")).toBe(-10);
  });
});

describe("итоговый порог броска", () => {
  /** Провести бросок навыка целиком и вернуть карточку из чата. */
  async function rollSkill(system, { roll = 50, modifier = "0" } = {}) {
    const s = sheet(system);
    const promise = s._rollSkill("Медицина", 45, "int", { skill: "medicae" });
    captured.nextRoll = roll;
    await captured.press("roll", fakeForm({
      "#skill-target": "45", "#skill-char-select": "int", "#skill-modifier": modifier
    }));
    await promise;
    return captured.chat.at(-1)?.content ?? "";
  }

  it("бросается один d100", async () => {
    await rollSkill({});
    expect(captured.rolls).toEqual(["1d100"]);
  });

  it("порог складывает цель и модификатор", async () => {
    const card = await rollSkill({}, { modifier: "10" });
    expect(card).toContain("Порог: <b>55</b>");
  });

  it("Усталость видна в карточке и снижает порог", async () => {
    const card = await rollSkill({ fatigue: { value: 1 } });
    expect(card).toContain("😓 Усталость");
    expect(card).toContain("Порог: <b>35</b>");
  });

  it("успех и провал считаются от итогового порога", async () => {
    expect(await rollSkill({}, { roll: 45 })).toContain("Успех");
    expect(await rollSkill({}, { roll: 46 })).toContain("Провал");
  });
});

describe("Вид теста: любой тест можно переключить (стр. 25-26)", () => {
  /** Провести бросок навыка с произвольными полями/галочками и вернуть карточку и лист. */
  async function rollSkillWith(system, { roll = 50, fields = {}, checks = {} } = {}) {
    const s = sheet(system);
    const promise = s._rollSkill("Медицина", 45, "int", { skill: "medicae" });
    captured.nextRoll = roll;
    await captured.press("roll", fakeForm({
      "#skill-target": "45", "#skill-char-select": "int", "#skill-modifier": "0", ...fields
    }, checks));
    await promise;
    return { content: captured.chat.at(-1)?.content ?? "", sheet: s };
  }

  it("Комбинированный: Порог — наименьший из двух", async () => {
    const { content } = await rollSkillWith({}, {
      roll: 25,
      fields: { "#test-kind": "combined", "#combined-char-select": "ag", "#combined-target": "20" }
    });
    // 25 меньше исходного Предела 45 (был бы Успех), но больше второго Предела
    // 20, взятого как итоговый — тест проваливается.
    expect(content).toContain("Комбинированный");
    expect(content).toContain("итоговый Порог <b>20</b>");
    expect(content).toContain("Провал");
  });

  it("Расширенный: банк Успехов копится на акторе между бросками", async () => {
    const s = sheet({});
    const fields = { "#test-kind": "extended", "#extended-label": "Вязь Зарока", "#extended-goal": "10" };
    const roll = async rv => {
      const promise = s._rollSkill("Медицина", 45, "int", { skill: "medicae" });
      captured.nextRoll = rv;
      await captured.press("roll", fakeForm({
        "#skill-target": "45", "#skill-char-select": "int", "#skill-modifier": "0", ...fields
      }));
      await promise;
      return captured.chat.at(-1)?.content ?? "";
    };

    const first = await roll(35);
    // Успех: 45-35=10 запаса → 1 полный десяток + 1 = 2 степени = +2 к банку.
    expect(first).toContain("Банк <b>2</b>/10");
    expect(s.actor.getFlag("warhammer-dbc", "extendedTests.вязь_зарока"))
      .toEqual({ accumulated: 2, target: 10 });

    // Тот же лист, тот же актор — второй бросок продолжает банк, а не начинает заново.
    const second = await roll(25);
    expect(second).toContain("Банк <b>5</b>/10");
    expect(s.actor.getFlag("warhammer-dbc", "extendedTests.вязь_зарока"))
      .toEqual({ accumulated: 5, target: 10 });
  });

  it("Встречный: с известным броском соперника карточка сама объявляет победителя", async () => {
    const { content } = await rollSkillWith({}, {
      roll: 30,
      fields: { "#test-kind": "opposed", "#opposed-threshold": "50", "#opposed-roll": "60" }
    });
    // Мои 2 степени успеха против его 2 степеней провала → margin 2-(-2)=4.
    expect(content).toContain("Вы побеждаете");
    expect(content).toContain("margin <b>4</b>");
  });

  it("Встречный: соперник не указан — карточка помечена как половина теста, сравнения нет", async () => {
    const { content } = await rollSkillWith({}, { fields: { "#test-kind": "opposed" } });
    expect(content).toContain("Встречный");
    expect(content).not.toContain("побеждает");
  });
});

describe("Сложность: единая таблица, отдельная строка в карточке", () => {
  async function rollSkillWith(system, { roll = 50, fields = {} } = {}) {
    const s = sheet(system);
    const promise = s._rollSkill("Медицина", 45, "int", { skill: "medicae" });
    captured.nextRoll = roll;
    await captured.press("roll", fakeForm({
      "#skill-target": "45", "#skill-char-select": "int", "#skill-modifier": "0", ...fields
    }));
    await promise;
    return captured.chat.at(-1)?.content ?? "";
  }

  it("выбранная Сложность входит в Порог и показана своей строкой", async () => {
    const content = await rollSkillWith({}, { roll: 30, fields: { "#test-difficulty": "-20" } });
    expect(content).toContain("Порог: <b>25</b>");
    expect(content).toContain("-20 (📊 Сложность)");
    expect(content).toContain("Провал");
  });
});

describe("Критические Успехи и Провалы (стр. 25)", () => {
  async function rollSkillWith(system, { roll = 50 } = {}) {
    const s = sheet(system);
    const promise = s._rollSkill("Медицина", 45, "int", { skill: "medicae" });
    captured.nextRoll = roll;
    await captured.press("roll", fakeForm({
      "#skill-target": "45", "#skill-char-select": "int", "#skill-modifier": "0"
    }));
    await promise;
    return captured.chat.at(-1)?.content ?? "";
  }

  it("натуральный бросок 1-5 — Критический Успех, независимо от Предела", () => {
    return rollSkillWith({}, { roll: 4 }).then(content =>
      expect(content).toContain("Критический Успех"));
  });

  it("натуральный бросок 96-100 — Критический Провал", () => {
    return rollSkillWith({}, { roll: 97 }).then(content =>
      expect(content).toContain("Критический Провал"));
  });

  it("вне диапазона — крит-строки нет", () => {
    return rollSkillWith({}, { roll: 50 }).then(content =>
      expect(content).not.toContain("Критический"));
  });
});

describe("Кубик: Преимущество/Помеха доступны на любом тесте (стр. 26)", () => {
  it("Преимущество бросает дважды и берёт меньший (лучший на d100)", async () => {
    const s = sheet({});
    const promise = s._rollSkill("Медицина", 45, "int", { skill: "medicae" });
    captured.dice = [80, 20];
    await captured.press("roll", fakeForm({
      "#skill-target": "45", "#skill-char-select": "int", "#skill-modifier": "0"
    }, { ".dice-mode-opt:checked": [{ value: "advantage" }] }));
    await promise;
    expect(captured.rolls).toEqual(["1d100", "1d100"]);
    expect(captured.chat.at(-1)?.content).toContain("Бросок: <b>20</b>");
  });

  it("Помеха берёт больший", async () => {
    const s = sheet({});
    const promise = s._rollSkill("Медицина", 45, "int", { skill: "medicae" });
    captured.dice = [80, 20];
    await captured.press("roll", fakeForm({
      "#skill-target": "45", "#skill-char-select": "int", "#skill-modifier": "0"
    }, { ".dice-mode-opt:checked": [{ value: "disadvantage" }] }));
    await promise;
    expect(captured.chat.at(-1)?.content).toContain("Бросок: <b>80</b>");
  });
});

describe("регрессия: тест Характеристики теперь тоже уважает переброс/Кубик", () => {
  // Ревизия главы «Тесты» нашла, что _rollCharacteristic полностью игнорировал
  // result.reroll — диалог показывал переброс, а бросок всегда был одиночным.
  it("Преимущество даёт два броска и на тесте Характеристики, а не только Навыка", async () => {
    const s = sheet({});
    const promise = s._rollCharacteristic("Ловкость", "Ag", 45, "ag", true);
    captured.dice = [90, 10];
    await captured.press("roll", fakeForm({
      "#skill-target": "45", "#skill-modifier": "0"
    }, { ".dice-mode-opt:checked": [{ value: "advantage" }] }));
    await promise;
    expect(captured.rolls).toEqual(["1d100", "1d100"]);
    expect(captured.chat.at(-1)?.content).toContain("Бросок: <b>10</b>");
  });
});

// wdbc-uez7: та же кнопка «Делегировать», что теперь есть у любого обычного
// теста (Навык/Характеристика) — исполнитель бросает СВОИМ листом (this.actor
// в _showSkillRollDialog/_rollSkill/_rollCharacteristic — уже сам executor,
// см. hooks.mjs::registerDelegatedTestOpener("genericTest", ...)), а
// Таланты/Черты effectTargetActor с областью ":recipient" поднимают/снижают
// Порог — не иначе, чем у Лечения (healing.mjs::patientHealingMod).
function effectTarget(name, { items = [] } = {}) {
  const updates = [];
  const flags = {};
  return {
    id: `${name}-stub`, name, items,
    system: { characteristics: {} },
    update: async data => { updates.push(data); return data; },
    getFlag: (ns, key) => flags[`${ns}.${key}`],
    setFlag: async (ns, key, value) => { flags[`${ns}.${key}`] = value; return value; },
    updates
  };
}

describe("делегированный тест (wdbc-uez7): _showSkillRollDialog с effectTargetActor", () => {
  it("без effectTargetActor — поведение не меняется: нет заметки, «Цель» — как раньше", () => {
    sheet({})._showSkillRollDialog("Медицина", 45, "int", false, { skill: "medicae" });
    expect(captured.dialog.content).not.toContain("📨 За");
    expect(captured.dialog.content).toContain('value="45"');
  });

  it("с effectTargetActor — заметка «За …», Порог поднимается модификатором цели (:recipient)", async () => {
    const { registerRuleSource, clearRuleSources, getRuleSources } = await import("../../module/rules/sources.mjs");
    const saved = getRuleSources();
    clearRuleSources();
    registerRuleSource("test", () => [
      { id: "pain-tol", label: "Высокий болевой порог",
        effects: [{ kind: "rollBonus", target: "skill:medicae:recipient", value: 10 }] }
    ]);
    try {
      const patient = effectTarget("Пациент");
      sheet({})._showSkillRollDialog("Медицина", 45, "int", false, { skill: "medicae" }, "base", { effectTargetActor: patient });
      expect(captured.dialog.content).toContain("📨 За <b>Пациент</b>");
      expect(captured.dialog.content).toContain("Высокий болевой порог");
      expect(captured.dialog.content).toContain('value="55"'); // 45 + 10
    } finally {
      clearRuleSources();
      for (const [key, fn] of saved) registerRuleSource(key, fn);
    }
  });

  it("effectTargetActor === this.actor (та же цель) не считается делегированием — заметки нет", () => {
    const s = sheet({});
    s._showSkillRollDialog("Медицина", 45, "int", false, { skill: "medicae" }, "base", { effectTargetActor: s.actor });
    expect(captured.dialog.content).not.toContain("📨 За");
  });

  it("кнопка «Делегировать» есть, когда effectTargetActor не задан; исчезает, когда это УЖЕ делегированный вызов", () => {
    sheet({})._showSkillRollDialog("Медицина", 45, "int", false, { skill: "medicae" });
    expect(captured.dialog.buttons.some(b => b.action === "delegate")).toBe(true);

    const patient = effectTarget("Пациент");
    sheet({})._showSkillRollDialog("Медицина", 45, "int", false, { skill: "medicae" }, "base", { effectTargetActor: patient });
    expect(captured.dialog.buttons.some(b => b.action === "delegate")).toBe(false);
  });
});

describe("делегированный тест (wdbc-uez7): _rollSkill/_rollCharacteristic маршрутизируют последствия на effectTargetActor", () => {
  it("_rollSkill: Банк Расширенного теста пишется на effectTargetActor, не на исполнителя; карточка называет цель", async () => {
    const patient = effectTarget("Пациент");
    const s = sheet({});
    const promise = s._rollSkill("Медицина", 45, "int", { skill: "medicae" }, { effectTargetActor: patient });
    captured.nextRoll = 10; // eff=45, 10<=45 успех
    await captured.press("roll", fakeForm({
      "#skill-target": "45", "#skill-modifier": "0", "#test-kind": "extended",
      "#extended-goal": "5", "#extended-label": "Медицина"
    }));
    await promise;

    // Банк Расширенного — на пациенте (effectTargetActor), не на исполнителе.
    expect(await patient.getFlag("warhammer-dbc", "extendedTests.медицина")).toBeTruthy();
    expect(captured.chat.at(-1)?.content).toContain("— за Пациент");
  });

  it("_rollCharacteristic: то же самое — исход применяется к effectTargetActor, карточка называет цель", async () => {
    const patient = effectTarget("Пациент");
    const s = sheet({});
    const promise = s._rollCharacteristic("Воля", "WP", 45, "wp", true, { effectTargetActor: patient });
    captured.nextRoll = 10;
    await captured.press("roll", fakeForm({ "#skill-target": "45", "#skill-modifier": "0" }));
    await promise;
    expect(captured.chat.at(-1)?.content).toContain("— за Пациент");
  });
});

// wdbc-j814: авто-встречный тест — соперник берётся из game.user.targets,
// галочка #opposed-auto заменяет ручной ввод Порога/Броска соперника.
describe("авто-встречный тест (wdbc-j814)", () => {
  const realFromUuid = globalThis.fromUuid;
  const realUsers = globalThis.game.users;

  afterEach(() => {
    globalThis.fromUuid = realFromUuid;
    globalThis.game.user = { ...globalThis.game.user, targets: new Set() };
    globalThis.game.users = realUsers;
  });

  /** Соперник-NPC: без testUserPermission — activeOwnerOf всегда вернёт null. */
  function npcOpponent(name, { skills = {}, characteristics = {} } = {}) {
    const opp = { id: `${name}-stub`, uuid: `Actor.${name}-stub`, name,
      system: { skills, characteristics } };
    globalThis.fromUuid = async uuid => (uuid === opp.uuid ? opp : null);
    globalThis.game.user = { ...globalThis.game.user, targets: new Set([{ actor: opp }]) };
    return opp;
  }

  /** Соперник-игрок: testUserPermission совпадает с активным пользователем в game.users. */
  function playerOpponent(name) {
    const owner = { id: "u1", name: "ИгрокСоперника", active: true };
    globalThis.game.users = Object.assign([owner], { players: [owner] });
    const opp = { id: `${name}-stub`, uuid: `Actor.${name}-stub`, name,
      system: { skills: {}, characteristics: {} },
      testUserPermission: (u, level) => level === "OWNER" && u.id === owner.id };
    globalThis.fromUuid = async uuid => (uuid === opp.uuid ? opp : null);
    globalThis.game.user = { ...globalThis.game.user, targets: new Set([{ actor: opp }]) };
    return { opp, owner };
  }

  it("NPC без активного владельца: галочка сразу даёт готовый результат — одно сообщение, opposedLine заполнена", async () => {
    npcOpponent("Драго", { skills: { intimidate: { total: 40 } } });
    const s = sheet({});
    const promise = s._rollSkill("Запугивание", 45, "wp", { skill: "intimidate" });
    // Очередь кубов: первый d100 — мой бросок (rollD100WithReroll), второй —
    // соперника (_resolveOpposedAuto), в этом порядке их и зовёт _rollSkill.
    captured.dice = [20, 60]; // мой 20<=45 успех, его 60>40 провал
    await captured.press("roll", fakeForm({
      "#skill-target": "45", "#skill-modifier": "0", "#test-kind": "opposed"
    }, { "#opposed-auto": [{ dataset: {}, checked: true }] }));
    await promise;

    expect(captured.chat).toHaveLength(1);
    const content = captured.chat[0].content;
    expect(content).toContain("Вы побеждаете");
    expect(content).not.toContain("Ждём встречный бросок");
  });

  it("мутация: неверный resolveOpposed/skillTotal должен уронить проверку margin/победителя", async () => {
    npcOpponent("Драго", { skills: { intimidate: { total: 999 } } }); // заведомо гарантированный проигрыш инициатора
    const s = sheet({});
    const promise = s._rollSkill("Запугивание", 45, "wp", { skill: "intimidate" });
    captured.dice = [20, 21]; // мой 20<=45 успех, но соперник при пороге 999 громит степенью
    await captured.press("roll", fakeForm({
      "#skill-target": "45", "#skill-modifier": "0", "#test-kind": "opposed"
    }, { "#opposed-auto": [{ dataset: {}, checked: true }] }));
    await promise;
    // Соперник (Порог 999, почти гарантированный высокий Успех) должен
    // побеждать — если резолвер сломан (например, всегда "mine"), тест падает.
    expect(captured.chat[0].content).toContain("Соперник побеждает");
  });

  it("соперник с активным владельцем: моё сообщение без opposedLine, но с «Ждём…», плюс отдельный делегированный запрос с моими цифрами", async () => {
    playerOpponent("Ксерксот");
    const s = sheet({});
    const promise = s._rollSkill("Запугивание", 45, "wp", { skill: "intimidate" });
    captured.nextRoll = 20;
    await captured.press("roll", fakeForm({
      "#skill-target": "45", "#skill-modifier": "0", "#test-kind": "opposed"
    }, { "#opposed-auto": [{ dataset: {}, checked: true }] }));
    await promise;

    expect(captured.chat).toHaveLength(2);
    expect(captured.chat[0].content).toContain("Ждём встречный бросок");
    expect(captured.chat[0].content).not.toContain("Побеждает");

    const requestCard = captured.chat[1];
    expect(requestCard.flags?.["warhammer-dbc"]?.delegatedTest?.kind).toBe("opposedResponse");
    const payload = requestCard.flags["warhammer-dbc"].delegatedTest;
    expect(payload.initiatorSide).toMatchObject({ threshold: 45, roll: 20 });
  });

  it("кнопка «Делегировать» отсутствует, когда opposedRequest задан (ответ соперника не делегируется дальше)", () => {
    const s = sheet({});
    s._showSkillRollDialog("Запугивание", 45, "wp", false, { skill: "intimidate" }, "base", {
      opposedRequest: { initiatorName: "Иван", initiatorSide: { threshold: 40, roll: 30, success: true, deg: 1 }, safe: false }
    });
    expect(captured.dialog.buttons.some(b => b.action === "delegate")).toBe(false);
  });

  it("ответ соперника (opposedRequest): публикует карточку сравнения с готовым победителем", async () => {
    const s = sheet({});
    const promise = s._rollSkill("Запугивание", 50, "wp", { skill: "intimidate" }, {
      opposedRequest: { initiatorName: "Иван", initiatorSide: { threshold: 40, roll: 35, success: true, deg: 1 }, safe: false }
    });
    captured.nextRoll = 5; // 5 <= 50 — большой успех, должен побеждать
    await captured.press("roll", fakeForm({ "#skill-target": "50", "#skill-modifier": "0", "#test-kind": "base" }));
    await promise;
    const content = captured.chat.at(-1)?.content ?? "";
    expect(content).toContain("⚔");
    expect(content).toContain("Иван");
  });
});

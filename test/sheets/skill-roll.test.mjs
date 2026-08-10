// Строки 10–11 таблицы сверки (docs/checks/stage-2.md) и фаза 4 конвейера:
// сложение галочек в диалоге, бонус снятого шлема, штраф Усталости и итоговый
// порог броска.
//
// Единственный тест в проекте, которому нужна заглушка Foundry: лист персонажа
// наследует класс из foundry.appv1 при загрузке модуля. Сама проверяемая логика
// заглушку не задействует — см. test/support/foundry-stub.mjs.

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured, sheetOf, fakeHtml, checkbox } from "../support/foundry-stub.mjs";

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
  captured.dialog.buttons.roll.callback(fakeHtml({
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
    captured.dialog.buttons.roll.callback(fakeHtml({
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

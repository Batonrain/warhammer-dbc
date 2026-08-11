// test/sheets/attack-roll.test.mjs
//
// Шаг 5.2: правила реестра доходят до диалога атаки и до порога броска — тем же
// путём, каким они уже доходят до броска навыка (test/sheets/skill-roll.test.mjs).
//
// Проверка сквозная: правило регистрируется в настоящем реестре источников,
// попадает в разметку диалога галочкой, а отмеченная галочка меняет порог,
// который печатается в карточке атаки.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { captured, resetCaptured, sheetOf, fakeHtml, checkbox } from "../support/foundry-stub.mjs";
import { weaponFor, setTargets } from "../support/combat-fixtures.mjs";
import { registerRuleSource, clearRuleSources, getRuleSources } from "../../module/rules/sources.mjs";

// Динамический импорт: глобали Foundry должны быть на месте раньше листа.
const { WarhammerCharacterSheet } = await import("../../module/sheets/actor-sheet.mjs");

const DEFAULT_SOURCES = getRuleSources();

const sheetWith = weapon => sheetOf(WarhammerCharacterSheet, {
  characteristics: { ws: { total: 45, bonus: 4 }, bs: { total: 45, bonus: 4 }, s: { total: 40, bonus: 4 } },
  fatigue: { value: 0 },
  items: [weapon]
});

/** Зарегистрировать одно правило вместо всех источников. */
function onlyRule(effects, rule = {}) {
  clearRuleSources();
  registerRuleSource("test", () => [{ id: "r", label: "Проверочное правило", effects, ...rule }]);
}

/** Открыть диалог атаки и нажать «Бросок!» с заданными галочками. */
async function pressAttack(sheet, weapon, checks = {}) {
  const promise = sheet._showAttackDialog(weapon);
  await captured.dialog.buttons.roll.callback(fakeHtml({
    "#atk-char": "bs", "#atk-threshold": "45", "#atk-modifier": "0", "#atk-aim": ""
  }, checks));
  return promise;
}

/** Порог, напечатанный в карточке атаки. */
function thresholdInCard() {
  const m = (captured.chat.at(-1)?.content ?? "").match(/<label>Порог<\/label><b>(-?\d+)<\/b>/);
  return m ? Number(m[1]) : null;
}

beforeEach(() => {
  resetCaptured();
  setTargets([]);
  captured.dice = [23, 6];
});

afterEach(() => {
  clearRuleSources();
  for (const [key, fn] of Object.entries(DEFAULT_SOURCES)) registerRuleSource(key, fn);
});

describe("правила в диалоге атаки", () => {
  it("правило области «attack» даёт галочку", () => {
    onlyRule([{ kind: "rollBonus", target: "attack", value: 10 }]);
    const weapon = weaponFor();
    const { html, mods } = sheetWith(weapon)._ruleRollModsHtml({
      kind: "attack", weaponClass: "basic", isMelee: false, char: "bs"
    });
    expect(mods).toEqual([{ ruleId: "r", label: "Проверочное правило", value: 10, halvePenalty: false }]);
    expect(html).toContain("rule-mod");
    expect(html).toContain("Проверочное правило");
  });

  it("галочка правила доходит до разметки самого диалога атаки", async () => {
    onlyRule([{ kind: "rollBonus", target: "weapon:ranged", value: -5 }]);
    const weapon = weaponFor();
    const sheet  = sheetWith(weapon);
    const promise = sheet._showAttackDialog(weapon);
    expect(captured.dialog.content).toContain("Проверочное правило");
    captured.dialog.buttons.cancel.callback();
    await promise;
  });

  it("правило рукопашной не показывается у стрелкового оружия", async () => {
    onlyRule([{ kind: "rollBonus", target: "weapon:melee", value: 10 }]);
    const weapon = weaponFor();
    const sheet  = sheetWith(weapon);
    const promise = sheet._showAttackDialog(weapon);
    expect(captured.dialog.content).not.toContain("Проверочное правило");
    captured.dialog.buttons.cancel.callback();
    await promise;
  });

  it("отмеченная галочка меняет порог броска", async () => {
    onlyRule([{ kind: "rollBonus", target: "attack", value: 15 }]);
    const weapon = weaponFor();
    await pressAttack(sheetWith(weapon), weapon, { ".rule-mod:checked": [checkbox(15)] });
    expect(thresholdInCard()).toBe(60);   // 45 + 15
  });

  it("неотмеченная галочка порог не меняет: модификатор не применяется молча", async () => {
    onlyRule([{ kind: "rollBonus", target: "attack", value: 15 }]);
    const weapon = weaponFor();
    await pressAttack(sheetWith(weapon), weapon);
    expect(thresholdInCard()).toBe(45);
  });

  it("«ополовинить штраф» ополовинивает итоговый минус", async () => {
    onlyRule([{ kind: "penaltyMul", target: "attack", factor: 0.5 }]);
    const weapon = weaponFor();
    await pressAttack(sheetWith(weapon), weapon, {
      ".rule-mod:checked": [checkbox(0, true)],
      ".atk-mod-cb:not([data-autofail]):checked": [checkbox(-20)]
    });
    expect(thresholdInCard()).toBe(35);   // 45 − 20 → штраф вдвое → 45 − 10
  });
});

// test/rules/library/conditions.test.mjs
//
// wdbc-r5o7: штрафы книжных Состояний, переведённые в реестр правил. Первое —
// «Повален» (стр. 30-31): −20 на свои рукопашные атаки, +20 на Скрытность.
// Остальные четыре последствия (Dodge, Движение, штрафы ПО нему) считаются не
// здесь — см. заголовок module/rules/library/conditions.mjs.

import { describe, it, expect } from "vitest";
import { resolveTest } from "../../../module/rules/resolve-test.mjs";
import { CONDITION_RULES } from "../../../module/rules/library/conditions.mjs";

const actor = (conditions = {}) => ({
  system: { race: "human", characteristics: {}, conditions }, items: []
});

describe("правила Состояний", () => {
  it("«Повален» есть в библиотеке", () => {
    expect(CONDITION_RULES.map(r => r.id)).toContain("conditions.prone");
  });

  it("рукопашная атака Поваленного получает −20", () => {
    const { mods } = resolveTest({
      actor: actor({ prone: true }), kind: "attack", weaponClass: "melee", isMelee: true, char: "ws"
    });
    expect(mods).toEqual([expect.objectContaining({ ruleId: "conditions.prone", value: -20 })]);
  });

  it("стрелковая атака Поваленного не штрафуется этим правилом", () => {
    const { mods } = resolveTest({
      actor: actor({ prone: true }), kind: "attack", weaponClass: "basic", isMelee: false, char: "bs"
    });
    expect(mods).toEqual([]);
  });

  it("Скрытность Поваленного получает +20", () => {
    const { mods } = resolveTest({ actor: actor({ prone: true }), skill: "stealth", char: "ag" });
    expect(mods).toEqual([expect.objectContaining({ ruleId: "conditions.prone", value: 20 })]);
  });

  it("не Повален — ни рукопашная, ни Скрытность не трогаются", () => {
    expect(resolveTest({
      actor: actor(), kind: "attack", weaponClass: "melee", isMelee: true, char: "ws"
    }).mods).toEqual([]);
    expect(resolveTest({ actor: actor(), skill: "stealth", char: "ag" }).mods).toEqual([]);
  });

  it("другое Состояние (не Повален) правило не запускает", () => {
    const { mods } = resolveTest({
      actor: actor({ stunned: true }), kind: "attack", weaponClass: "melee", isMelee: true, char: "ws"
    });
    expect(mods).toEqual([]);
  });

  it("встал (prone:false) — бонус/штраф пропадают", () => {
    const { mods } = resolveTest({ actor: actor({ prone: false }), skill: "stealth", char: "ag" });
    expect(mods).toEqual([]);
  });
});

// «Отравление» (стр. 30-31, wdbc-r5o7.1): −10 к Пределу Крит. Провала на
// всех тестах, кроме T/Inf/Cor. Механизм готов целиком (critRangeMod) —
// только запись правила плюс тест.
describe("правило «Отравление»", () => {
  it("есть в библиотеке", () => {
    expect(CONDITION_RULES.map(r => r.id)).toContain("conditions.poisoned");
  });

  it("расширяет Критический Провал на 10 (side failure)", () => {
    const { crit } = resolveTest({ actor: actor({ poisoned: true }), skill: "medicae", char: "int" });
    expect(crit).toEqual({ successExtra: 0, failExtra: 10 });
  });

  it("не Отравлен — crit не тронут", () => {
    const { crit } = resolveTest({ actor: actor(), skill: "medicae", char: "int" });
    expect(crit).toEqual({ successExtra: 0, failExtra: 0 });
  });

  it.each(["t", "inf", "cor"])("исключение — тест характеристики %s не штрафуется", char => {
    const { crit } = resolveTest({ actor: actor({ poisoned: true }), char });
    expect(crit).toEqual({ successExtra: 0, failExtra: 0 });
  });

  it("действует на атаку (WS/BS — не в списке исключений)", () => {
    const { crit } = resolveTest({
      actor: actor({ poisoned: true }), kind: "attack", weaponClass: "melee", isMelee: true, char: "ws"
    });
    expect(crit).toEqual({ successExtra: 0, failExtra: 10 });
  });

  it("другое Состояние (не Отравление) правило не запускает", () => {
    const { crit } = resolveTest({ actor: actor({ prone: true }), skill: "medicae", char: "int" });
    expect(crit).toEqual({ successExtra: 0, failExtra: 0 });
  });
});

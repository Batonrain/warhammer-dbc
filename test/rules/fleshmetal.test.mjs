// test/rules/fleshmetal.test.mjs
//
// Fleshmetal / Плотеметалл (Таланты Механикума, Sahara 3-cc96 п.8; DoomBC —
// Основная книга): Haywire вместо Оглушения/Паралича отнимает лишь одно
// полудействие; оружие со свойством Sanctified игнорирует AP от Трейта Machine.

import "../support/foundry-stub.mjs";
import { describe, it, expect } from "vitest";
import { hasFleshmetal, machineApOf, fleshmetalMachineApCut, fleshmetalHaywireText } from "../../module/rules/fleshmetal.mjs";

const talent = { type: "talent", name: "Fleshmetal / Плотеметалл", system: {} };
const machine = rating => ({ type: "trait", name: "Machine / Машина (X)", system: { rating } });
const actor = items => ({ type: "character", items, system: {} });

describe("Плотеметалл: Sanctified снимает AP от Machine", () => {
  it("рейтинги нескольких Machine складываются (как складывается их броня)", () => {
    expect(machineApOf(actor([machine(3), machine(2)]))).toBe(5);
    expect(machineApOf(actor([]))).toBe(0);
  });
  it("Талант + Machine + освящённое оружие — снять AP Machine", () => {
    expect(fleshmetalMachineApCut(actor([talent, machine(4)]), { sanctified: true })).toBe(4);
  });
  it("не освящённое оружие, нет Таланта, нет Machine — ничего", () => {
    expect(fleshmetalMachineApCut(actor([talent, machine(4)]), { sanctified: false })).toBe(0);
    expect(fleshmetalMachineApCut(actor([machine(4)]), { sanctified: true })).toBe(0);
    expect(fleshmetalMachineApCut(actor([talent]), { sanctified: true })).toBe(0);
    expect(hasFleshmetal(actor([talent]))).toBe(true);
  });
  it("Machine Empathy (Талант) за Machine не считается", () => {
    const emp = { type: "talent", name: "Machine Empathy / Машинная Эмпатия", system: { rating: 5 } };
    expect(machineApOf(actor([emp]))).toBe(0);
  });
});

describe("Плотеметалл: подсказка таблицы ЭМИ", () => {
  it("Оглушение Машины и Беспомощность Машины заменяются потерей полудействия", () => {
    const stun = fleshmetalHaywireText("Действия с хай-тек снаряжением −20. SPD силовой брони −3. Машины Оглушены, пока не покинут поле.");
    expect(stun).toContain("теряет одно полудействие");
    expect(stun).not.toContain("Оглушены");
    const dead = fleshmetalHaywireText("Хай-тек снаряжение отключено. Машины Беспомощны.");
    expect(dead).toContain("теряет одно полудействие");
    expect(dead).not.toContain("Беспомощны");
  });
  it("«Как Мёртвая Зона…» получает пометку; строка без Оглушения не меняется", () => {
    expect(fleshmetalHaywireText("Как Мёртвая Зона, но на два Хода.")).toContain("Плотеметалл");
    expect(fleshmetalHaywireText("Никакого эффекта.")).toBe("Никакого эффекта.");
  });
});

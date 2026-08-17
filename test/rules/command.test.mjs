// test/rules/command.test.mjs
//
// Что доходит до подчинённого от Командования. Правило одно на два пути —
// состав Отряда и свободный список «Под моим Присутствием», — поэтому живёт
// без Foundry и проверяется напрямую.

import { describe, it, expect } from "vitest";
import { PRESENCE_ORDER, presenceNumber, presenceBenefitsFor, receivesPresence,
         receivesCommands, commandHealsPsych, canBeForcedToMove,
         suppressionBonus, commandReachFor } from "../../module/rules/command.mjs";
import { PRESENCE_BENEFITS } from "../../module/constants/squad.mjs";

describe("нумерация преимуществ Присутствия", () => {
  it("совпадает с порядком в реестре Отряда — правила ссылаются номерами", () => {
    expect(PRESENCE_ORDER).toEqual(PRESENCE_BENEFITS.map(b => b.key));
  });

  it("эффект 1 — Экстремальный Урон, 2 — Концентрация огня, 3 — Воля Командира", () => {
    expect(presenceNumber("extreme")).toBe(1);
    expect(presenceNumber("focus")).toBe(2);
    expect(presenceNumber("morale")).toBe(3);
  });

  it("неизвестный ключ номера не имеет", () => {
    expect(presenceNumber("нет такого")).toBe(0);
  });
});

describe("Орда под Командованием", () => {
  it("получает только эффекты 1 и 3 Присутствия", () => {
    expect(presenceBenefitsFor("horde")).toEqual(["extreme", "morale"]);
    expect(receivesPresence("horde", "extreme")).toBe(true);
    expect(receivesPresence("horde", "morale")).toBe(true);
    expect(receivesPresence("horde", "focus")).toBe(false);
  });

  it("Коротких и Детальных Команд не получает вовсе", () => {
    expect(receivesCommands("horde")).toBe(false);
  });

  it("тест Командования по ней лечит психологический урон", () => {
    expect(commandHealsPsych("horde")).toBe(true);
  });

  it("сдвинуть её против воли нельзя", () => {
    expect(canBeForcedToMove("horde")).toBe(false);
  });

  it("к тестам Подавления получает бонус, равный Магнитуде", () => {
    expect(suppressionBonus({ type: "horde", system: { magnitude: { value: 47 } } })).toBe(47);
  });
});

describe("прочие подчинённые", () => {
  for (const type of ["character", "daemon", "demonPrince", "vehicle", "minion"]) {
    it(`«${type}» получает всё Командование целиком`, () => {
      expect(presenceBenefitsFor(type)).toEqual(PRESENCE_ORDER);
      expect(receivesCommands(type)).toBe(true);
      expect(commandHealsPsych(type)).toBe(false);
      expect(canBeForcedToMove(type)).toBe(true);
      expect(suppressionBonus({ type, system: { magnitude: { value: 47 } } })).toBe(0);
    });
  }
});

describe("сводка по подчинённому", () => {
  it("у Орды объясняет каждое ограничение словами", () => {
    const reach = commandReachFor("horde");
    expect(reach.commands).toBe(false);
    expect(reach.notes.length).toBeGreaterThan(3);
  });

  it("предупреждает, что выбранное преимущество до Орды не доходит", () => {
    const reach = commandReachFor("horde", "focus");
    expect(reach.presenceApplies).toBe(false);
    expect(reach.notes.join(" ")).toContain("эффект 2");
  });

  it("доходящее преимущество возражений не вызывает", () => {
    expect(commandReachFor("horde", "morale").presenceApplies).toBe(true);
  });

  it("у персонажа ограничений нет и объяснять нечего", () => {
    const reach = commandReachFor("character", "focus");
    expect(reach).toMatchObject({ presenceApplies: true, commands: true, forcedMove: true });
    expect(reach.notes).toEqual([]);
  });
});

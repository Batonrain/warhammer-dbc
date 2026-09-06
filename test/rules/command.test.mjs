// test/rules/command.test.mjs
//
// Что доходит до подчинённого от Командования. Правило одно на два пути —
// состав Отряда и свободный список «Под моим Присутствием», — поэтому живёт
// без Foundry и проверяется напрямую.

import { describe, it, expect, afterEach } from "vitest";
import { PRESENCE_ORDER, presenceNumber, presenceBenefitsFor, receivesPresence,
         receivesCommands, commandHealsPsych, canBeForcedToMove,
         suppressionBonus, commandReachFor } from "../../module/rules/command.mjs";
import { PRESENCE_BENEFITS } from "../../module/constants/squad.mjs";
import { registerRuleSource, clearRuleSources, getRuleSources } from "../../module/rules/sources.mjs";

const DEFAULT_SOURCES = getRuleSources();
afterEach(() => {
  clearRuleSources();
  for (const [key, fn] of DEFAULT_SOURCES) registerRuleSource(key, fn);
});

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

// Оглох (стр. 30-31, wdbc-r5o7.6): «не получает эффектов Командования, кроме
// жестов/телепатии/Ноосферы» — per-АКТОР исключение (второй параметр),
// в отличие от Орды выше (per-ТИП, первый параметр).
describe("Оглох блокирует Короткие и Детальные Команды", () => {
  const deaf = { type: "character", system: { conditions: { deafened: true } }, items: [] };
  const hearing = { type: "character", system: { conditions: {} }, items: [] };

  it("receivesCommands(type, actor) — false для Оглохшего", () => {
    expect(receivesCommands("character", deaf)).toBe(false);
  });

  it("receivesCommands(type, actor) — true без Оглохшести", () => {
    expect(receivesCommands("character", hearing)).toBe(true);
  });

  it("receivesCommands(type) без второго параметра — старое поведение (не ломает Отряд)", () => {
    expect(receivesCommands("character")).toBe(true);
    expect(receivesCommands("horde")).toBe(false);
  });

  it("Орда остаётся false независимо от Оглохшести (тип решает первым)", () => {
    expect(receivesCommands("horde", { type: "horde", system: { conditions: { deafened: true } } })).toBe(false);
  });

  it("commandReachFor — commands:false и объясняющая заметка", () => {
    const reach = commandReachFor("character", "", deaf);
    expect(reach.commands).toBe(false);
    expect(reach.notes.join(" ")).toContain("Оглох");
  });

  it("commandReachFor без Оглохшести — заметок нет", () => {
    const reach = commandReachFor("character", "", hearing);
    expect(reach.commands).toBe(true);
    expect(reach.notes).toEqual([]);
  });

  it("возможность communication.deafExempt (жесты/телепатия/Ноосфера) снимает блок", () => {
    registerRuleSource("test", () => [{ id: "a", label: "Тест",
      effects: [{ kind: "grantFlag", target: "communication.deafExempt" }] }]);
    expect(receivesCommands("character", deaf)).toBe(true);
  });
});

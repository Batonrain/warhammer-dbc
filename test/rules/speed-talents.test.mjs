// test/rules/speed-talents.test.mjs
//
// Таланты Скорости (глава 3): чистая логика rules/speed-talents.mjs.

import "../support/foundry-stub.mjs";
import { describe, it, expect } from "vitest";
import {
  hasSpeedTalent, SPEED_TALENTS, standUpApCost, clearJamApCost, jumpApCost, rapidReloadApCost,
  quickDrawWeaponEligible, speedTalentDistances, sprintFatigueDue, repositionAvailable, breacherReady
} from "../../module/rules/speed-talents.mjs";

const actorWith = (...names) => ({
  items: names.map((name, i) => ({ id: `t${i}`, type: "talent", name })),
  getFlag: () => undefined
});

describe("hasSpeedTalent", () => {
  it("находит Талант по имени предмета (любая половина двуязычного имени)", () => {
    expect(hasSpeedTalent(actorWith("Leap Up / Вскочить"), "leapUp")).toBe(true);
    expect(hasSpeedTalent(actorWith("Sprint / Спринт"), "sprint")).toBe(true);
  });
  it("без Таланта — false; неизвестный ключ — false", () => {
    expect(hasSpeedTalent(actorWith("Sprint / Спринт"), "leapUp")).toBe(false);
    expect(hasSpeedTalent(actorWith(), "sprint")).toBe(false);
    expect(hasSpeedTalent(actorWith("Sprint / Спринт"), "нет-такого")).toBe(false);
  });
  it("у каждого Таланта свой ключ Возможности speed.core.*", () => {
    for (const t of Object.values(SPEED_TALENTS)) expect(t.key).toMatch(/^speed\.core\./);
    expect(new Set(Object.values(SPEED_TALENTS).map(t => t.key)).size).toBe(Object.keys(SPEED_TALENTS).length);
  });
});

describe("стоимости действий", () => {
  it("Вскочить: Встать 1 ОД → 0", () => {
    expect(standUpApCost(false)).toBe(1);
    expect(standUpApCost(true)).toBe(0);
  });
  it("Технический Трюк: Расклин 2 ОД → 1", () => {
    expect(clearJamApCost(false)).toBe(2);
    expect(clearJamApCost(true)).toBe(1);
  });
  it("Прыжок: 2 ОД; Прыгун — 1 ОД; Прыгун частью Натиска — 0", () => {
    expect(jumpApCost()).toBe(2);
    expect(jumpApCost({ partOfCharge: true })).toBe(2); // без Таланта «часть Натиска» ничего не даёт
    expect(jumpApCost({ jumper: true })).toBe(1);
    expect(jumpApCost({ jumper: true, partOfCharge: true })).toBe(0);
  });
  it("Быстрая Перезарядка: ОД пополам вниз — ½ (1 ОД) бесплатно, 2→1, 4→2, 6→3", () => {
    expect([1, 2, 4, 6, 20].map(rapidReloadApCost)).toEqual([0, 1, 2, 3, 10]);
  });
  it("Быстрая Перезарядка: бесплатная перезарядка остаётся бесплатной", () => {
    expect(rapidReloadApCost(0)).toBe(0);
    expect(rapidReloadApCost(undefined)).toBe(0);
  });
});

describe("quickDrawWeaponEligible: что можно Взять/Сложить свободно", () => {
  it("метательное, пистолет и ручное (винтовка) — всегда", () => {
    for (const weaponClass of ["thrown", "pistol", "basic"]) {
      expect(quickDrawWeaponEligible({ weaponClass }, 2)).toBe(true);
    }
  });
  it("рукопашное — только в одну руку", () => {
    expect(quickDrawWeaponEligible({ weaponClass: "melee" }, 1)).toBe(true);
    expect(quickDrawWeaponEligible({ weaponClass: "melee" }, 0)).toBe(true);
    expect(quickDrawWeaponEligible({ weaponClass: "melee" }, 2)).toBe(false);
  });
  it("тяжёлое, пусковое, стационарное — нет", () => {
    for (const weaponClass of ["heavy", "launcher", "stationary", undefined]) {
      expect(quickDrawWeaponEligible({ weaponClass }, 1)).toBe(false);
    }
    expect(quickDrawWeaponEligible(undefined, 1)).toBe(false);
  });
});

describe("speedTalentDistances: Запредельная Скорость и Спринт (SPD 3)", () => {
  const base = { move: 6, charge: 9, run: 18 };
  it("без Талантов — без изменений", () => {
    expect(speedTalentDistances(base)).toEqual({ ...base, sprintRun: 0 });
  });
  it("Запредельная Скорость: Натиск на дистанцию Бега", () => {
    expect(speedTalentDistances(base, { preternatural: true })).toEqual({ move: 6, charge: 18, run: 18, sprintRun: 0 });
  });
  it("Спринт: Полное Движение = Натиск (SPD×3), Бег — двойной, run не меняется", () => {
    expect(speedTalentDistances(base, { sprint: true })).toEqual({ move: 9, charge: 9, run: 18, sprintRun: 36 });
  });
  it("оба: Полное — от обычного Натиска (SPD×3), Натиск — от Бега", () => {
    expect(speedTalentDistances(base, { sprint: true, preternatural: true }))
      .toEqual({ move: 9, charge: 18, run: 18, sprintRun: 36 });
  });
  it("нулевая дистанция (нет ног) остаётся нулевой", () => {
    expect(speedTalentDistances({ move: 0, charge: 0, run: 0 }, { sprint: true, preternatural: true }))
      .toEqual({ move: 0, charge: 0, run: 0, sprintRun: 0 });
  });
  it("Спринт не уменьшает Полное Движение, если оно уже больше Натиска", () => {
    expect(speedTalentDistances({ move: 12, charge: 9, run: 18 }, { sprint: true }).move).toBe(12);
  });
});

describe("sprintFatigueDue: два Хода подряд", () => {
  const cur = { combatId: "c1", round: 3 };
  it("прошлый Раунд того же боя — да", () => {
    expect(sprintFatigueDue({ combatId: "c1", round: 2 }, cur)).toBe(true);
  });
  it("через Раунд, тот же Раунд, другой бой, нет метки — нет", () => {
    expect(sprintFatigueDue({ combatId: "c1", round: 1 }, cur)).toBe(false);
    expect(sprintFatigueDue({ combatId: "c1", round: 3 }, cur)).toBe(false);
    expect(sprintFatigueDue({ combatId: "c0", round: 2 }, cur)).toBe(false);
    expect(sprintFatigueDue(null, cur)).toBe(false);
  });
  it("вне боя (пустой id) — никогда", () => {
    expect(sprintFatigueDue({ combatId: "", round: 0 }, { combatId: "", round: 1 })).toBe(false);
  });
});

describe("repositionAvailable", () => {
  it("первый Раунд боя, ещё не использована — да", () => {
    expect(repositionAvailable({ combatId: "c1", round: 1, ready: true })).toBe(true);
  });
  it("использована, второй Раунд или нет боя — нет", () => {
    expect(repositionAvailable({ combatId: "c1", round: 1, ready: false })).toBe(false);
    expect(repositionAvailable({ combatId: "c1", round: 2, ready: true })).toBe(false);
    expect(repositionAvailable({ round: 1, ready: true })).toBe(false);
    expect(repositionAvailable()).toBe(false);
  });
});

describe("breacherReady: Талант + щит + Защитная Стойка", () => {
  it("все три условия — да", () => {
    expect(breacherReady({ talent: true, shield: true, stance: "defensive" })).toBe(true);
  });
  it("не хватает любого — нет", () => {
    expect(breacherReady({ talent: false, shield: true, stance: "defensive" })).toBe(false);
    expect(breacherReady({ talent: true, shield: false, stance: "defensive" })).toBe(false);
    expect(breacherReady({ talent: true, shield: true, stance: "standard" })).toBe(false);
    expect(breacherReady()).toBe(false);
  });
});

// test/combat/armor-stealthed-covered.test.mjs
//
// Sahara wdbc-x1nz-4-stealthed: Stealthed — «+10 на тесты Stealth… если
// поверх этой брони не носить больше ничего, кроме разве что легкой разгрузки
// или пояса». Разгрузка и пояс — снаряжение (gear), не броня, поэтому «что-то
// поверх» — другая надетая броня, закрывающая хотя бы одну из тех же
// локаций и не являющаяся сама Подкладкой (undersuit — носится ПОД бронёй).
// Самый частый случай за столом: Комбинезон из Синтекожи под Панцирем.

import { describe, it, expect } from "vitest";
import { armorWornOver, armorSkillModsFor } from "../../module/combat/armor-properties.mjs";

const LOCS = { head: 0, body: 0, leftArm: 0, rightArm: 0, leftLeg: 0, rightLeg: 0 };
const armor = (id, properties, ap, equipped = true) =>
  ({ id, type: "armor", name: id, system: { equipped, properties, ...LOCS, ...ap } });
const ALL2 = { head: 2, body: 2, leftArm: 2, rightArm: 2, leftLeg: 2, rightLeg: 2 };

const bodyglove = armor("Синтекожа", ["sealed", "soft", "stealthed", "undersuit"], ALL2);
const carapace = armor("Панцирь", ["hard"], { body: 6, leftArm: 5, rightArm: 5, leftLeg: 5, rightLeg: 5 });
const scout = armor("Панцирь Скаутов", ["open", "hard", "stealthed"], { body: 5, leftArm: 4, rightArm: 4, leftLeg: 4, rightLeg: 4 });
const meshUnder = armor("Поддоспешник", ["protective", "sealed", "stealthed", "undersuit"], ALL2);
const helmet = armor("Шлем", ["hard"], { head: 4 });

describe("armorWornOver: что надето поверх брони", () => {
  it("одна броня — поверх ничего", () => {
    expect(armorWornOver(bodyglove, [bodyglove])).toBeNull();
  });
  it("Синтекожа под Панцирем — Панцирь поверх", () => {
    expect(armorWornOver(bodyglove, [bodyglove, carapace])?.id).toBe("Панцирь");
  });
  it("Подкладка под Панцирем Скаутов Панцирю не мешает", () => {
    expect(armorWornOver(scout, [scout, meshUnder])).toBeNull();
  });
  it("шлем поверх Панциря Скаутов: локации не пересекаются — не мешает", () => {
    expect(armorWornOver(scout, [scout, helmet])).toBeNull();
  });
  it("шлем поверх Синтекожи (голова) — мешает", () => {
    expect(armorWornOver(bodyglove, [bodyglove, helmet])?.id).toBe("Шлем");
  });
  it("снятая броня не считается", () => {
    expect(armorWornOver(bodyglove, [bodyglove, { ...carapace, system: { ...carapace.system, equipped: false } }])).toBeNull();
  });
});

describe("armorSkillModsFor: +10 Stealth снимается, если поверх что-то надето", () => {
  it("одна Синтекожа — +10 Stealth", () => {
    expect(armorSkillModsFor(bodyglove, [bodyglove]).mods.stealth).toBe(10);
  });
  it("Синтекожа под Панцирем — бонуса нет, причина названа", () => {
    const r = armorSkillModsFor(bodyglove, [bodyglove, carapace]);
    expect(r.mods.stealth ?? 0).toBe(0);
    expect(r.stealthedCoveredBy?.id).toBe("Панцирь");
  });
  it("Панцирь Скаутов с Подкладкой под ним — +10 у Панциря остаются", () => {
    expect(armorSkillModsFor(scout, [scout, meshUnder]).mods.stealth).toBe(10);
  });
});

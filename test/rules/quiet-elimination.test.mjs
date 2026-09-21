// test/rules/quiet-elimination.test.mjs
//
// Quiet Elimination / Тихое Устранение (wdbc-1rno.3, aeldari-branches.json):
// «Если персонаж атакует противника врасплох, то он наносит на +1 кубик
// урона больше, а цель не издаёт звука при гибели. Если персонаж использует
// только ножи или игольчатые/осколочные пистолеты, он получает +10 к
// тестам атаки.» — isQuietEliminationWeapon отвечает только на ВТОРОЙ,
// оружейный пункт (не завязан на Врасплох, см. test/combat/
// attack-quiet-elimination.test.mjs для первого).

import "../support/foundry-stub.mjs";
import { describe, it, expect } from "vitest";
import { hasQuietElimination, isQuietEliminationWeapon } from "../../module/rules/quiet-elimination.mjs";

function actorWith(items) { return { items }; }
function trait(name) { return { id: "t1", type: "trait", name }; }

describe("hasQuietElimination", () => {
  it("находит по русскому имени", () => {
    expect(hasQuietElimination(actorWith([trait("Тихое Устранение")]))).toBe(true);
  });
  it("находит по английскому имени", () => {
    expect(hasQuietElimination(actorWith([trait("Quiet Elimination")]))).toBe(true);
  });
  it("нет предмета — false", () => {
    expect(hasQuietElimination(actorWith([]))).toBe(false);
  });
});

describe("isQuietEliminationWeapon", () => {
  it("нож (meleeCategory Нож) — да", () => {
    const knife = { system: { weaponClass: "melee", meleeCategory: "Нож" } };
    expect(isQuietEliminationWeapon(knife)).toBe(true);
  });

  it("осколочный пистолет (weaponType splinter, weaponClass pistol) — да", () => {
    const w = { system: { weaponClass: "pistol", weaponType: "splinter" } };
    expect(isQuietEliminationWeapon(w)).toBe(true);
  });

  it("игольчатый пистолет по имени (weaponType не структурирован единообразно) — да", () => {
    const w = { name: "Needler Pistol / Игольный Пистолет", system: { weaponClass: "pistol", weaponType: "exotic" } };
    expect(isQuietEliminationWeapon(w)).toBe(true);
  });

  it("осколочная ВИНТОВКА (не пистолет) — нет, правило только про пистолеты", () => {
    const w = { system: { weaponClass: "basic", weaponType: "splinter" } };
    expect(isQuietEliminationWeapon(w)).toBe(false);
  });

  it("обычный болтерный пистолет — нет", () => {
    const w = { name: "Bolt Pistol", system: { weaponClass: "pistol", weaponType: "bolt" } };
    expect(isQuietEliminationWeapon(w)).toBe(false);
  });

  it("рукопашное не-ножевое оружие — нет", () => {
    const w = { system: { weaponClass: "melee", meleeCategory: "Меч" } };
    expect(isQuietEliminationWeapon(w)).toBe(false);
  });
});

// test/rules/library/core.test.mjs
//
// Правила основной книги — те, что действуют у всех, независимо от расы и
// Происхождения. Первое такое правило — «Проворный»: оно принадлежит цели, а
// действует на того, кто по ней бьёт.

import { describe, it, expect } from "vitest";
import { resolveTest } from "../../../module/rules/resolve-test.mjs";
import { CORE_RULES } from "../../../module/rules/library/core.mjs";

/** Подставной актор: обычный литерал, без Foundry. */
const actor = ({ items = [], ...system } = {}) => ({
  system: { race: "human", characteristics: {}, ...system }, items
});

/** Цель с Чертой «Проворный» и заданным Бонусом Ловкости. */
const nimbleTarget = (agBonus, name = "Nimble / Проворный") => actor({
  race: "astartes",
  characteristics: { ag: { total: agBonus * 10, bonus: agBonus } },
  items: [{ type: "trait", name }]
});

const attackOn = targetActor => resolveTest({
  actor: actor(), kind: "attack", weaponClass: "basic", isMelee: false, char: "bs", targetActor
});

describe("правила основной книги", () => {
  it("«Проворный» есть в библиотеке", () => {
    expect(CORE_RULES.map(r => r.id)).toContain("core.nimble");
  });

  it("атака по Проворной цели получает минус её Бонус Ловкости", () => {
    const { mods } = attackOn(nimbleTarget(4));
    expect(mods).toEqual([expect.objectContaining({ ruleId: "core.nimble", value: -4 })]);
  });

  it("у более ловкой цели штраф больше", () => {
    expect(attackOn(nimbleTarget(7)).mods[0].value).toBe(-7);
  });

  it("Черта опознаётся у всех рас, как бы ни был записан рейтинг в названии", () => {
    // «Nimble / Проворный» у Астартес и «Nimble (10) / Проворный (10)» у Кроорка.
    expect(attackOn(nimbleTarget(4, "Nimble (10) / Проворный (10)")).mods[0].value).toBe(-4);
  });

  it("по обычной цели штрафа нет", () => {
    expect(attackOn(actor({ characteristics: { ag: { bonus: 4 } } })).mods).toEqual([]);
  });

  it("без цели правило не срабатывает", () => {
    expect(attackOn(null).mods).toEqual([]);
  });

  it("в тест навыка правило не лезет: это штраф попаданию", () => {
    const { mods } = resolveTest({ actor: actor(), skill: "medicae", char: "int", targetActor: nimbleTarget(4) });
    expect(mods).toEqual([]);
  });
});

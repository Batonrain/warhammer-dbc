// test/rules/library/core.test.mjs
//
// Правила основной книги — те, что действуют у всех, независимо от расы и
// Происхождения. Первое такое правило — «Проворный»: оно принадлежит цели, а
// действует на того, кто по ней бьёт.

import { describe, it, expect } from "vitest";
import { resolveTest } from "../../../module/rules/resolve-test.mjs";
import { collectRules } from "../../../module/rules/collect.mjs";
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

  it("Оглушённая цель штрафа не даёт: скоростью не воспользоваться", () => {
    const target = nimbleTarget(4);
    target.system.conditions = { stunned: true };
    expect(attackOn(target).mods).toEqual([]);
  });

  it("сняли Оглушение — штраф вернулся", () => {
    const target = nimbleTarget(4);
    target.system.conditions = { stunned: false };
    expect(attackOn(target).mods[0].value).toBe(-4);
  });

  it("Беспомощная цель тоже штрафа не даёт", () => {
    const target = nimbleTarget(4);
    target.system.conditions = { helpless: true };
    expect(attackOn(target).mods).toEqual([]);
  });

  // wdbc-r5o7.3: Ступор считается Оглушением «для прочих эффектов» (стр. 30-31).
  it("Ступор — та же скидка, что Оглушение (цель им не воспользуется)", () => {
    const target = nimbleTarget(4);
    target.system.conditions = { dazed: true };
    expect(attackOn(target).mods).toEqual([]);
  });
});

describe("core.nimble и силовая броня", () => {
  const armor = armorType => ({ type: "armor", system: { armorType, equipped: true } });
  const blackCarapace = (installed = true) => ({
    type: "implant", name: "19. Чёрный Панцирь / Black Carapace",
    flags: { "warhammer-dbc": { installed } }
  });

  it("силовая броня без Чёрного Панциря гасит штраф целиком", () => {
    const target = nimbleTarget(4);
    target.items.push(armor("power"));
    expect(attackOn(target).mods).toEqual([]);
  });

  it("с установленным Чёрным Панцирем штраф остаётся", () => {
    const target = nimbleTarget(4);
    target.items.push(armor("power"), blackCarapace());
    expect(attackOn(target).mods.find(m => m.ruleId === "core.nimble")?.value).toBe(-4);
  });

  it("Чёрный Панцирь не установлен (в инвентаре) — штраф всё равно гасится", () => {
    const target = nimbleTarget(4);
    target.items.push(armor("power"), blackCarapace(false));
    expect(attackOn(target).mods).toEqual([]);
  });

  it("небронированная (flak) броня Nimble не трогает", () => {
    const target = nimbleTarget(4);
    target.items.push(armor("flak"));
    expect(attackOn(target).mods.find(m => m.ruleId === "core.nimble")?.value).toBe(-4);
  });
});

describe("core.sizeToHit и core.sizeStealth (стр. 30, таблица Размера)", () => {
  const sized = sizeMod => actor({ sizeMod });

  it("Размер 1 даёт атакующим +10", () => {
    const { mods } = attackOn(sized(1));
    expect(mods).toEqual([expect.objectContaining({ ruleId: "core.sizeToHit", value: 10 })]);
  });

  it("отрицательный Размер даёт отрицательный штраф", () => {
    expect(attackOn(sized(-1)).mods[0].value).toBe(-10);
  });

  it("масштаб линейный: Размер 2 даёт +20", () => {
    expect(attackOn(sized(2)).mods[0].value).toBe(20);
  });

  it("Размер 0 — строки в чек-листе нет вовсе, не «(+0)»", () => {
    expect(attackOn(sized(0)).mods).toEqual([]);
  });

  it("Скрытность: тот же Размер даёт МИНУС собственному тесту (обратный знак)", () => {
    const { mods } = resolveTest({ actor: sized(1), skill: "stealth", char: "ag" });
    expect(mods).toEqual([expect.objectContaining({ ruleId: "core.sizeStealth", value: -10 })]);
  });

  it("Скрытность обычного человека не трогается", () => {
    const { mods } = resolveTest({ actor: sized(0), skill: "stealth", char: "ag" });
    expect(mods).toEqual([]);
  });
});

// «Доступна папка талантов Псайкера/Псайканы» (item-picker.mjs::
// talentGroupLock, wdbc-sauo) — общее для всех рас, не расовое правило.
describe("core.psyker", () => {
  it("собирается при ненулевом Пси-Рейтинге, у любой расы", () => {
    const flags = collectRules(actor({ psyker: { rating: 3 } }))
      .flatMap(r => r.effects).filter(e => e.kind === "grantFlag").map(e => e.target);
    expect(flags).toContain("talents.psyker");
  });

  it("не собирается при нулевом/отсутствующем Пси-Рейтинге", () => {
    expect(collectRules(actor()).map(r => r.id)).not.toContain("core.psyker");
    expect(collectRules(actor({ psyker: { rating: 0 } })).map(r => r.id)).not.toContain("core.psyker");
  });
});

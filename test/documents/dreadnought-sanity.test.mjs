// test/documents/dreadnought-sanity.test.mjs
//
// wdbc-a7s: «Здравомыслие» пилота Дредноута на самом акторе (Книга Машин,
// стр. 57). Формула и пороги посчитаны и покрыты юнит-тестами в
// rules/dreadnought.mjs (sanityMax, madnessLevels) — здесь проверяется
// ДОВОД ДО АКТОРА: что prepareDerivedData реально кладёт max/пороги в
// system.sanity, а не просто умеет их посчитать где-то в стороне.
//
// Кто именно пилот — знает только Дредноут (module/rules/sources.mjs), и это
// требует game.actors. Здесь этого нет и не должно быть: max зависит только от
// W.b и своих Талантов персонажа, и добывается без единого обращения к миру
// (см. комментарий в module/documents/actor.mjs у блока «Здравомыслие»).

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { WarhammerActor } from "../../module/documents/actor.mjs";
import { ACTOR_DATA_MODELS } from "../../module/data/index.mjs";

/** Предмет на акторе — талант по имени, как их читает счётчик «Ядра Воспоминаний». */
const talent = name => ({ id: name, name, type: "talent", system: {}, getFlag: () => undefined });

/** Персонаж со схемой по умолчанию: W.b выставляется через base, как везде в проекте. */
function characterWith({ wpBase = 0, sanityValue, items = [] } = {}) {
  const system = new ACTOR_DATA_MODELS.character({}).toObject();
  system.characteristics.wp.base = wpBase;
  if (sanityValue !== undefined) system.sanity.value = sanityValue;
  const list = [...items];
  list.get = id => list.find(i => i.id === id) ?? null;
  WarhammerActor.prototype.prepareDerivedData.call({
    type: "character", name: "Подставной", system, items: list, getFlag: () => undefined
  });
  return system;
}

describe("Здравомыслие пилота Дредноута: максимум доходит до актора", () => {
  it("W 45 (W.b 4) → максимум 58, как sanityMax(4)", () => {
    expect(characterWith({ wpBase: 45 }).sanity.max).toBe(58);
  });

  it("без Воли максимум — базовые 50", () => {
    expect(characterWith({ wpBase: 0 }).sanity.max).toBe(50);
  });

  it("«Ядро Воспоминаний» считается по своим Талантам актора, не абстрактным числом", () => {
    const items = [
      talent("Core Memories / Ядро Воспоминаний"),
      talent("Core Memories / Ядро Воспоминаний"),
      talent("Iron Wrath / Железный Гнев")
    ];
    expect(characterWith({ wpBase: 45, items }).sanity.max).toBe(58 + 10);
  });

  it("Талант другого типа предмета (не talent) не считается", () => {
    const items = [{ id: "x", name: "Core Memories / Ядро Воспоминаний", type: "gear", system: {} }];
    expect(characterWith({ wpBase: 45, items }).sanity.max).toBe(58);
  });
});

describe("Здравомыслие: значение зажато между 0 и максимумом", () => {
  it("не может превысить максимум (напр., после падения W.b от урона характеристике)", () => {
    const s = characterWith({ wpBase: 0, sanityValue: 999 });
    expect(s.sanity.value).toBe(s.sanity.max);
  });

  it("не уходит в минус", () => {
    expect(characterWith({ sanityValue: -12 }).sanity.value).toBe(0);
  });

  it("нормальное значение внутри диапазона не трогается", () => {
    expect(characterWith({ wpBase: 45, sanityValue: 30 }).sanity.value).toBe(30);
  });
});

describe("Пороги Безумия кладутся в system.sanity.thresholds", () => {
  it("складываются по убыванию, как madnessLevels", () => {
    const s = characterWith({ wpBase: 45, sanityValue: 35 });
    expect(s.sanity.thresholds).toEqual([50, 40]);
  });

  it("на полном Здравомыслии — пусто", () => {
    const s = characterWith({ wpBase: 45, sanityValue: 58 });
    expect(s.sanity.thresholds).toEqual([]);
  });

  it("на нуле — все шесть, включая перманентную Ярость", () => {
    const s = characterWith({ wpBase: 0, sanityValue: 0 });
    expect(s.sanity.thresholds).toEqual([50, 40, 30, 20, 10, 0]);
  });
});

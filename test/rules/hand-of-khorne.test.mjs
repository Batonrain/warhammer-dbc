// test/rules/hand-of-khorne.test.mjs
//
// Длань Кхорна (wdbc-1rno, Дар Кхорна): «основная рука» — не поле на акторе
// (система не знает право-/леворукости), а флаг на самом Даре (выбор один
// раз). Бонусы цепляются к ТЕКУЩЕМУ оружию в этой руке (getHeldHand) или к
// двуручному оружию целиком.

import "../support/foundry-stub.mjs";
import { describe, it, expect } from "vitest";
import {
  isHandOfKhorneItem, handOfKhorneItemOf, handOfKhorneHand,
  isHandOfKhorneWeapon, handOfKhorneStrengthMultiplier,
  handOfKhorneAttackSizeBonus, handOfKhorneBlocksRangedAttack, HAND_FLAG
} from "../../module/rules/hand-of-khorne.mjs";

const NS = "warhammer-dbc";

function giftItem(hand = null) {
  const flags = hand ? { [HAND_FLAG]: hand } : {};
  return {
    type: "mutation", name: "Hand of Khorne / Длань Кхорна",
    flags: {},
    getFlag: (ns, key) => (ns === NS ? flags[key] : undefined)
  };
}

function weapon({ weaponClass = "melee", grips = "1р", heldHand = null, owner } = {}) {
  const flags = {};
  if (heldHand) flags.heldHand = heldHand;
  const w = {
    type: "weapon", system: { weaponClass, grips },
    parent: owner,
    getFlag: (ns, key) => (ns === NS ? flags[key] : undefined)
  };
  if (owner) owner.items = [...(owner.items || []), w];
  return w;
}

function actorWithGift(hand) {
  const gift = giftItem(hand);
  const actor = { items: [gift] };
  return actor;
}

describe("isHandOfKhorneItem / handOfKhorneItemOf / handOfKhorneHand", () => {
  it("опознаёт Дар по имени", () => {
    expect(isHandOfKhorneItem(giftItem())).toBe(true);
  });

  it("другой предмет — false", () => {
    expect(isHandOfKhorneItem({ type: "mutation", name: "Blood Flame / Кровавое Пламя", flags: {} })).toBe(false);
  });

  it("Дара нет на акторе — handOfKhorneHand null", () => {
    expect(handOfKhorneHand({ items: [] })).toBeNull();
  });

  it("Дар есть, рука ещё не выбрана — null", () => {
    expect(handOfKhorneHand(actorWithGift(null))).toBeNull();
  });

  it("рука выбрана — возвращает её", () => {
    expect(handOfKhorneHand(actorWithGift("right"))).toBe("right");
  });

  it("handOfKhorneItemOf находит сам предмет Дара", () => {
    const actor = actorWithGift("left");
    expect(handOfKhorneItemOf(actor)).toBe(actor.items[0]);
  });
});

describe("isHandOfKhorneWeapon — какое оружие сейчас в бронзовой руке", () => {
  it("нет Дара на акторе — false, даже если оружие в правой руке", () => {
    const owner = { items: [] };
    const w = weapon({ heldHand: "right", owner });
    expect(isHandOfKhorneWeapon(w)).toBe(false);
  });

  it("Дар есть, но рука не выбрана — false", () => {
    const owner = actorWithGift(null);
    const w = weapon({ heldHand: "right", owner });
    expect(isHandOfKhorneWeapon(w)).toBe(false);
  });

  it("оружие в ПРАВИЛЬНОЙ (бронзовой) руке — true", () => {
    const owner = actorWithGift("right");
    const w = weapon({ heldHand: "right", owner });
    expect(isHandOfKhorneWeapon(w)).toBe(true);
  });

  it("оружие в ДРУГОЙ руке — false", () => {
    const owner = actorWithGift("right");
    const w = weapon({ heldHand: "left", owner });
    expect(isHandOfKhorneWeapon(w)).toBe(false);
  });

  it("оружие без пометки руки вовсе — false (не угадывается)", () => {
    const owner = actorWithGift("right");
    const w = weapon({ owner });
    expect(isHandOfKhorneWeapon(w)).toBe(false);
  });

  it("двуручное оружие — true независимо от пометки руки (обе руки заняты)", () => {
    const owner = actorWithGift("left");
    const w = weapon({ grips: "2р", owner });
    expect(isHandOfKhorneWeapon(w)).toBe(true);
  });

  it("не предмет-оружие (например Мутация) — false", () => {
    expect(isHandOfKhorneWeapon({ type: "mutation" })).toBe(false);
  });

  it("null — false, не падает", () => {
    expect(isHandOfKhorneWeapon(null)).toBe(false);
  });
});

describe("handOfKhorneStrengthMultiplier / handOfKhorneAttackSizeBonus", () => {
  it("бронзовая рука — ×2 S.b, +2 Размера атакующего", () => {
    const owner = actorWithGift("right");
    const w = weapon({ heldHand: "right", owner });
    expect(handOfKhorneStrengthMultiplier(w)).toBe(2);
    expect(handOfKhorneAttackSizeBonus(w)).toBe(2);
  });

  it("обычная рука — ×1 (не эффект), +0 Размера", () => {
    const owner = actorWithGift("right");
    const w = weapon({ heldHand: "left", owner });
    expect(handOfKhorneStrengthMultiplier(w)).toBe(1);
    expect(handOfKhorneAttackSizeBonus(w)).toBe(0);
  });
});

describe("handOfKhorneBlocksRangedAttack — автопровал стрельбы бронзовой рукой", () => {
  it("дальнобойное оружие в бронзовой руке — блокирует", () => {
    const owner = actorWithGift("right");
    const w = weapon({ weaponClass: "basic", heldHand: "right", owner });
    expect(handOfKhorneBlocksRangedAttack(w)).toBe(true);
  });

  it("рукопашное в бронзовой руке — не блокирует (это не стрельба)", () => {
    const owner = actorWithGift("right");
    const w = weapon({ weaponClass: "melee", heldHand: "right", owner });
    expect(handOfKhorneBlocksRangedAttack(w)).toBe(false);
  });

  it("дальнобойное в ДРУГОЙ руке — не блокирует", () => {
    const owner = actorWithGift("right");
    const w = weapon({ weaponClass: "basic", heldHand: "left", owner });
    expect(handOfKhorneBlocksRangedAttack(w)).toBe(false);
  });

  it("брошенное (thrown) в бронзовой руке — не блокирует, книга про стрельбу, не метание", () => {
    const owner = actorWithGift("right");
    const w = weapon({ weaponClass: "thrown", heldHand: "right", owner });
    expect(handOfKhorneBlocksRangedAttack(w)).toBe(false);
  });
});

// test/rules/resilience-talents-b.test.mjs
//
// Таланты Стойкости (глава 3, пакет B): чистая логика rules/resilience-talents.mjs.
// Прикрытие Головы, Адская Живучесть, Взор Богов, Залегание, Аблативное Укрепление.

import "../support/foundry-stub.mjs";
import { describe, it, expect } from "vitest";
import {
  headGuardApplies, HEAD_GUARD_ARMS,
  hellishResilienceBonus, hellishResilienceNet, hellishResilienceTurnEnds,
  isNotableCharacter, eyeOfTheGodsBucket, eyeOfTheGodsUsed, eyeOfTheGodsCap, eyeOfTheGodsRecord,
  eyeOfTheGodsBypassed, EYE_OF_THE_GODS_LIMIT,
  ablativeHardeningRefill, pickHardeningArmor
} from "../../module/rules/resilience-talents.mjs";
import { coverApForLocation } from "../../module/rules/cover-locations.mjs";

const talent = name => ({ type: "talent", name, system: {}, flags: {} });
const actorWith = (items = [], system = {}, flags = {}) => ({
  items: items.map(i => (typeof i === "string" ? talent(i) : i)),
  system: { characteristics: { int: { bonus: 5 } }, corruptionBonus: 4, ...system },
  flags: { "warhammer-dbc": flags },
  getFlag: (_s, k) => flags[k]
});

describe("Прикрытие Головы: какие попадания", () => {
  it("обычное попадание в голову — да", () => expect(headGuardApplies("Голова")).toBe(true));
  it("Избирательный в глаз и в сочленения шеи — нет", () => {
    expect(headGuardApplies("Глаз (Голова)")).toBe(false);
    expect(headGuardApplies("Сочленение / Шея")).toBe(false);
  });
  it("торс и руки — нет", () => {
    expect(headGuardApplies("Торс")).toBe(false);
    expect(headGuardApplies("П. Рука")).toBe(false);
  });
  it("две руки на выбор: правая и левая", () => {
    expect(HEAD_GUARD_ARMS).toEqual({ rightArm: "П. Рука", leftArm: "Л. Рука" });
  });
});

describe("Адская Живучесть: +Cor.b поглощения", () => {
  it("у носителя бонус = Cor.b, у остальных 0", () => {
    expect(hellishResilienceBonus(actorWith(["Hellish Resilience / Адская Живучесть"]))).toBe(4);
    expect(hellishResilienceBonus(actorWith([]))).toBe(0);
  });
  it("урон уменьшается на бонус, но не ниже нуля", () => {
    expect(hellishResilienceNet(9, 4)).toBe(5);
    expect(hellishResilienceNet(3, 4)).toBe(0);
  });
  it("сколько концов своего Хода нужно пережить: в чужой Ход 1, в свой 2", () => {
    expect(hellishResilienceTurnEnds(false)).toBe(1);
    expect(hellishResilienceTurnEnds(true)).toBe(2);
  });
});

describe("Взор Богов: счёт потерянных Ран", () => {
  it("значимый — флаг актора", () => {
    expect(isNotableCharacter(actorWith([], {}, { notableCharacter: true }))).toBe(true);
    expect(isNotableCharacter(actorWith([]))).toBe(false);
  });

  it("корзина: рядовые — общая, значимый — своя по uuid; без uuid значимый = рядовой", () => {
    expect(eyeOfTheGodsBucket(false, "Actor.a")).toBe("general");
    expect(eyeOfTheGodsBucket(false, "")).toBe("general");
    expect(eyeOfTheGodsBucket(true, "Actor.boss")).toBe("notable:Actor.boss");
    expect(eyeOfTheGodsBucket(true, "")).toBe("general");
  });

  it("лимит 10: до 10 проходит, лишнее игнорируется", () => {
    expect(EYE_OF_THE_GODS_LIMIT).toBe(10);
    expect(eyeOfTheGodsCap(7, 0)).toEqual({ net: 7, ignored: 0 });
    expect(eyeOfTheGodsCap(7, 6)).toEqual({ net: 4, ignored: 3 });
    expect(eyeOfTheGodsCap(7, 10)).toEqual({ net: 0, ignored: 7 });
    expect(eyeOfTheGodsCap(0, 3)).toEqual({ net: 0, ignored: 0 });
  });

  it("запись накапливает по корзине; другой бой — счёт с нуля", () => {
    let flag = eyeOfTheGodsRecord(null, "c1", "general", 6);
    expect(eyeOfTheGodsUsed(flag, "c1", "general")).toBe(6);
    flag = eyeOfTheGodsRecord(flag, "c1", "general", 3);
    flag = eyeOfTheGodsRecord(flag, "c1", "notable:Actor.boss", 10);
    expect(eyeOfTheGodsUsed(flag, "c1", "general")).toBe(9);
    expect(eyeOfTheGodsUsed(flag, "c1", "notable:Actor.boss")).toBe(10);
    expect(eyeOfTheGodsUsed(flag, "c2", "general")).toBe(0);
    expect(eyeOfTheGodsRecord(flag, "c2", "general", 2)).toEqual({ combatId: "c2", buckets: { general: 2 } });
  });

  it("щит-дефлектор обходят: игнор щита и Освящённое", () => {
    expect(eyeOfTheGodsBypassed({ ignoreShield: true })).toBe(true);
    expect(eyeOfTheGodsBypassed({ sanctified: true })).toBe(true);
    expect(eyeOfTheGodsBypassed({})).toBe(false);
  });
});

describe("Залегание: AP укрытия по частям тела", () => {
  const marked = { ap: 4, head: false, body: true };

  it("без Залегания — как раньше", () => {
    expect(coverApForLocation(marked, "body", 0)).toBe(4);
    expect(coverApForLocation(marked, "head", 0)).toBe(0);
    expect(coverApForLocation({ ap: 4 }, "head", 0)).toBe(4);
  });
  it("Залегание: прикрытая (отмеченная) часть ×2, выглядывающая — обычное AP вместо 0", () => {
    expect(coverApForLocation(marked, "body", 0, { hunker: true })).toBe(8);
    expect(coverApForLocation(marked, "head", 0, { hunker: true })).toBe(4);
  });
  it("Залегание, отметок нет вовсе (укрытие общее) — ×2 везде", () => {
    expect(coverApForLocation({ ap: 4 }, "head", 0, { hunker: true })).toBe(8);
  });
  it("Залегание без укрытия — по-прежнему 0", () => {
    expect(coverApForLocation({ ap: 0, body: true }, "body", 0, { hunker: true })).toBe(0);
  });
  it("AP зоны (declaredAp) удваивается так же", () => {
    expect(coverApForLocation({ ap: 0 }, "body", 5, { hunker: true })).toBe(10);
  });
});

describe("Аблативное Укрепление: заряды", () => {
  const armor = (id, ap, charges, equipped = true) => ({ id, type: "armor", system: { equipped, ...ap, hardeningCharges: charges } });

  it("обслуживание даёт I.b зарядов только носителю", () => {
    expect(ablativeHardeningRefill(actorWith(["Ablative Hardening / Аблативное Укрепление"]))).toBe(5);
    expect(ablativeHardeningRefill(actorWith([]))).toBe(0);
  });

  it("платит надетая броня, закрывающая участок, с наибольшим запасом", () => {
    const a = armor("a", { body: 4 }, 1);
    const b = armor("b", { body: 3 }, 3);
    const c = armor("c", { head: 5 }, 9);          // участок не закрывает
    const d = armor("d", { body: 5 }, 9, false);   // не надета
    expect(pickHardeningArmor([a, b, c, d], "body").id).toBe("b");
  });
  it("зарядов нет — платить нечем", () => {
    expect(pickHardeningArmor([armor("a", { body: 4 }, 0)], "body")).toBe(null);
  });
  it("без участка — любая надетая с зарядами", () => {
    expect(pickHardeningArmor([armor("a", { head: 1 }, 2)], null).id).toBe("a");
  });
});

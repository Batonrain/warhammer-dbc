// test/combat/prisma.test.mjs
//
// Призма (стр. 74 Книги Аэльдари): заряд живёт на предмете (system.prismaCharge),
// тем же приёмом, что needsRecharge у Перезарядки. +1/Ход в руках (до рейтинга),
// доп. патроны (заряд×рейтинг), +1d10/+4 Pen на максимуме, сброс наполовину
// после выстрела.

import { describe, it, expect } from "vitest";
import { resolveWeaponPropsList, aggregateAuto } from "../../module/combat/weapon-properties.mjs";
import { processPrismaTurnStart, prismaFireBonus, halvePrismaCharge } from "../../module/combat/prisma.mjs";
import { weaponFor, actorFor } from "../support/combat-fixtures.mjs";

function prismaWeapon(rating, { id, ...overrides } = {}) {
  const w = weaponFor({ weaponProps: [{ key: "prisma", rating, rating2: 0 }], equipped: true, prismaCharge: 0, ...overrides },
    id ? { id } : undefined);
  w.type = "weapon"; // weaponFor() сам type не ставит (см. test/combat/defense.test.mjs equippedMelee)
  return w;
}

describe("processPrismaTurnStart: +1/Ход, пока в руках, до рейтинга", () => {
  it("экипированное оружие с Призмой получает +1 заряда", async () => {
    const w = prismaWeapon(3);
    const a = actorFor({ items: [w] });
    await processPrismaTurnStart(a);
    expect(w.system.prismaCharge).toBe(1);
  });

  it("не поднимается выше рейтинга X", async () => {
    const w = prismaWeapon(3, { prismaCharge: 3 });
    const a = actorFor({ items: [w] });
    await processPrismaTurnStart(a);
    expect(w.system.prismaCharge).toBe(3);
  });

  it("неэкипированное оружие заряд не копит", async () => {
    const w = prismaWeapon(3, { equipped: false });
    const a = actorFor({ items: [w] });
    await processPrismaTurnStart(a);
    expect(w.system.prismaCharge).toBe(0);
  });

  it("оружие без свойства Призма — не трогается", async () => {
    const w = weaponFor({ equipped: true, prismaCharge: 0 });
    const a = actorFor({ items: [w] });
    await processPrismaTurnStart(a);
    expect(w.system.prismaCharge).toBe(0);
  });

  it("несколько единиц оружия с Призмой на одном акторе — каждая копит своё", async () => {
    const w1 = prismaWeapon(2, { id: "w1" });
    const w2 = prismaWeapon(4, { id: "w2", prismaCharge: 1 });
    const a = actorFor({ items: [w1, w2] });
    await processPrismaTurnStart(a);
    expect(w1.system.prismaCharge).toBe(1);
    expect(w2.system.prismaCharge).toBe(2);
  });
});

describe("prismaFireBonus", () => {
  it("без свойства Призма — все нули, atMax false", () => {
    const w = weaponFor({ prismaCharge: 5 });
    const wp = aggregateAuto(resolveWeaponPropsList(w.system.weaponProps));
    expect(prismaFireBonus(w, wp)).toEqual({ charge: 0, rating: 0, atMax: false, extraAmmo: 0 });
  });

  it("заряд ниже максимума — atMax false, extraAmmo = заряд×рейтинг", () => {
    const w = prismaWeapon(3, { prismaCharge: 2 });
    const wp = aggregateAuto(resolveWeaponPropsList(w.system.weaponProps));
    expect(prismaFireBonus(w, wp)).toEqual({ charge: 2, rating: 3, atMax: false, extraAmmo: 6 });
  });

  it("заряд на максимуме — atMax true", () => {
    const w = prismaWeapon(3, { prismaCharge: 3 });
    const wp = aggregateAuto(resolveWeaponPropsList(w.system.weaponProps));
    expect(prismaFireBonus(w, wp).atMax).toBe(true);
  });
});

describe("halvePrismaCharge", () => {
  it("делит заряд пополам, округляя вниз", async () => {
    const w = prismaWeapon(6, { prismaCharge: 5 });
    const wp = aggregateAuto(resolveWeaponPropsList(w.system.weaponProps));
    await halvePrismaCharge(w, wp);
    expect(w.system.prismaCharge).toBe(2);
  });

  it("заряд 0 остаётся 0", async () => {
    const w = prismaWeapon(6, { prismaCharge: 0 });
    const wp = aggregateAuto(resolveWeaponPropsList(w.system.weaponProps));
    await halvePrismaCharge(w, wp);
    expect(w.system.prismaCharge).toBe(0);
  });

  it("оружие без Призмы (prismaRating 0) — halvePrismaCharge не трогает поле", async () => {
    const w = weaponFor({ prismaCharge: 5 });
    const wp = aggregateAuto(resolveWeaponPropsList(w.system.weaponProps));
    await halvePrismaCharge(w, wp);
    expect(w.system.prismaCharge).toBe(5);
  });
});

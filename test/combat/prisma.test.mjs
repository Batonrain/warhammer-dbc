// test/combat/prisma.test.mjs
//
// Призма (стр. 74 Книги Аэльдари): заряд живёт на предмете (system.prismaCharge),
// тем же приёмом, что needsRecharge у Перезарядки. +1/Ход в руках (до рейтинга),
// доп. патроны (заряд×рейтинг), +1d10/+4 Pen на максимуме, сброс наполовину
// после выстрела.

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { resolveWeaponPropsList, aggregateAuto } from "../../module/combat/weapon-properties.mjs";
import { processPrismaTurnStart, prismaFireBonus, halvePrismaCharge } from "../../module/combat/prisma.mjs";
import { _executeAttackRoll } from "../../module/combat/attack.mjs";
import { weaponFor, actorFor, setTargets } from "../support/combat-fixtures.mjs";

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

  // wdbc-8zi (п.8): раньше был отдельный item.update() на каждую единицу
  // оружия — начало Хода бойца с двумя-тремя стволами с Призмой писало
  // столько же отдельных апдейтов подряд. Теперь один updateEmbeddedDocuments
  // на актора со всеми правками сразу.
  it("несколько единиц оружия — один updateEmbeddedDocuments на всех, не по одному апдейту", async () => {
    const w1 = prismaWeapon(2, { id: "w1" });
    const w2 = prismaWeapon(4, { id: "w2", prismaCharge: 1 });
    const a = actorFor({ items: [w1, w2] });
    let calls = 0;
    const original = a.updateEmbeddedDocuments.bind(a);
    a.updateEmbeddedDocuments = async (...args) => { calls++; return original(...args); };

    await processPrismaTurnStart(a);

    expect(calls).toBe(1);
    expect(w1.system.prismaCharge).toBe(1);
    expect(w2.system.prismaCharge).toBe(2);
  });

  it("нечего обновлять (заряд на максимуме/неэкипировано) — updateEmbeddedDocuments не зовётся вовсе", async () => {
    const w = prismaWeapon(3, { prismaCharge: 3 });
    const a = actorFor({ items: [w] });
    let calls = 0;
    const original = a.updateEmbeddedDocuments.bind(a);
    a.updateEmbeddedDocuments = async (...args) => { calls++; return original(...args); };

    await processPrismaTurnStart(a);

    expect(calls).toBe(0);
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

// wdbc-8zi (п.5): раньше halvePrismaCharge был внутри `ammoSpent > 0`, а
// сама проверка `!opts.skipAmmo` дублировалась дважды подряд (мёртвый код) —
// оба привязаны к module/combat/attack.mjs (расход магазина). Заодно
// зафиксировано, ПОЧЕМУ старая связка с ammoSpent>0 не давала наблюдаемого
// разъезда на настоящем оружии: prisma.extraAmmo = заряд×рейтинг всегда
// прибавляется к ammoSpent, так что при заряде >0 (единственный случай, где
// halvePrismaCharge вообще что-то меняет) ammoSpent и без того гарантированно
// положителен — ammoSpent=0 возможен только при заряде=0, а половинить 0
// незачем в любом случае. Наблюдаемо здесь только то, что реально можно
// отличить: реальный выстрел halveит заряд, переброс/Очко Судьбы — нет.
describe("_executeAttackRoll × Призма (wdbc-8zi, п.5)", () => {
  const prismaShooter = (rating, prismaCharge) => weaponFor({
    weaponProps: [{ key: "prisma", rating, rating2: 0 }], prismaCharge
  });

  beforeEach(() => {
    resetCaptured();
    setTargets([]);
  });

  it("обычный выстрел: магазин тратится (1 + заряд×рейтинг патронов Призмы) и заряд падает вдвое", async () => {
    const weapon = prismaShooter(6, 1);   // extraAmmo = 1×6 = 6
    const actor  = actorFor({ items: [weapon] });
    captured.dice = [23, 6];

    await _executeAttackRoll(actor, weapon, "bs", 45, "single", null, {});

    expect(weapon.system.magazineCur).toBe(17);   // 24 − (1 + 6)
    expect(weapon.system.prismaCharge).toBe(0);   // floor(1/2)
  });

  it("skipAmmo (переброс/Очко Судьбы) — не тратит патрон и НЕ роняет заряд повторно", async () => {
    const weapon = prismaShooter(6, 1);
    const actor  = actorFor({ items: [weapon] });
    captured.dice = [23, 6];

    await _executeAttackRoll(actor, weapon, "bs", 45, "single", null, { skipAmmo: true });

    expect(weapon.system.magazineCur).toBe(24);   // не тронут
    expect(weapon.system.prismaCharge).toBe(1);   // не тронут — тот же выстрел, что уже посчитан
  });
});

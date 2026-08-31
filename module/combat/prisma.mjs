// module/combat/prisma.mjs
// ─────────────────────────────────────────────────────────────────────────────
//  ПРИЗМА (стр. 74 Книги Аэльдари): заряд живёт прямо на оружии
//  (system.prismaCharge), тем же приёмом, что needsRecharge у Перезарядки.
//  +1/Ход, пока оружие в руках (до рейтинга X); на максимуме — доп. кубик
//  урона и +4 Pen; после выстрела заряд падает вдвое (окр. вниз).
//
//  НЕ автоматизировано (см. комментарий в constants/weapon-properties.mjs):
//  ручное +1 за ОД/2 Реакции, ручное −N за ОД, распад вне рук, +½X к крит.
//  эффектам/Экстремальному урону, гейт «катализатор Призрачного Света».
// ─────────────────────────────────────────────────────────────────────────────

import { resolveWeaponPropsList } from "./weapon-properties.mjs";

/** Рейтинг X (максимум заряда) свойства Призма на предмете, либо 0. */
function prismaRatingOf(item) {
  const props = resolveWeaponPropsList(item?.system?.weaponProps);
  return props.find(p => p.key === "prisma")?.rating || 0;
}

/**
 * +1 к заряду Призмы всем экипированным единицам оружия персонажа «в
 * руках» (упрощение: приравниваем к «Снаряжено»), до их рейтинга X.
 * Зовётся из hooks.mjs в начале Хода актора (тот же хук, что resetActionEconomy).
 */
export async function processPrismaTurnStart(actor) {
  const weapons = (actor?.items ?? []).filter(i => i.type === "weapon" && i.system?.equipped);
  for (const item of weapons) {
    const max = prismaRatingOf(item);
    if (max <= 0) continue;
    const cur = Number(item.system.prismaCharge) || 0;
    if (cur < max) await item.update({ "system.prismaCharge": Math.min(max, cur + 1) });
  }
}

/**
 * Бонусы Призмы для текущего выстрела — читается в attack.mjs сразу после
 * aggregateAuto, обогащает wp дополнительными полями.
 * @returns {{charge:number, rating:number, atMax:boolean, extraAmmo:number}}
 */
export function prismaFireBonus(item, wp) {
  const rating = wp.prismaRating || 0;
  if (rating <= 0) return { charge: 0, rating: 0, atMax: false, extraAmmo: 0 };
  const charge = Number(item.system?.prismaCharge) || 0;
  return { charge, rating, atMax: charge >= rating, extraAmmo: charge * rating };
}

/** После выстрела — заряд падает вдвое (окр. вниз). Нет свойства → не трогаем. */
export async function halvePrismaCharge(item, wp) {
  if (!wp.prismaRating) return;
  const cur = Number(item.system?.prismaCharge) || 0;
  if (cur > 0) await item.update({ "system.prismaCharge": Math.floor(cur / 2) });
}

// module/combat/armor-field-shield.mjs
// ════════════════════════════════════════════════════════════════════════
//  ЩИТ «ЗАЩИТНОГО ПОЛЯ» ДРУКХАРИЙСКОЙ БРОНИ (wdbc-j8cn).
//
//  Психокостяной Тканый Костюм и Призрачная Броня в режиме «Защитное поле»
//  дают щит-купол 1–25/5 и 1–35/1 (constants/drukhari-armor-fields.mjs).
//  Своего конвейера щиту не нужно: примитив — встроенный Item типа
//  "forcefield", который читает combat/damage.mjs::_rollActiveShield. Ровно
//  так уже выдают щит Preservation (combat/preservation.mjs) и Щит Праздности
//  (combat/turn-state-shield.mjs). Здесь только СРОК ЖИЗНИ: щит есть, пока
//  броня надета и режим включён.
//
//  Метка на самом выданном предмете (flags.warhammer-dbc.armorFieldShield =
//  id брони), а не список на акторе — снять предмет значит снять метку,
//  рассинхрону взяться неоткуда (тот же приём, что rules/temp-grant.mjs).
//
//  Перегрузка: книжное «при перегрузке режим недоступен минуту» — щит уходит
//  в «перегружен» обычным конвейером и НЕ пересоздаётся, пока режим включён:
//  игрок видит перегруженный щит в инвентаре и поднимает его штатной кнопкой
//  ремонта. Минутный таймер отдельно не ведётся.
// ════════════════════════════════════════════════════════════════════════

import { fieldModeEffects, fieldSuitFor } from "../constants/drukhari-armor-fields.mjs";

const NS = "warhammer-dbc";
export const ARMOR_FIELD_SHIELD_FLAG = "armorFieldShield";

/**
 * Какие щиты полей должны висеть на акторе: по одному на надетую броню с
 * включённым Защитным полем. Чистая функция.
 * @returns {Array<{armorId: string, name: string, ratingMax: number, overload: number}>}
 */
export function desiredArmorFieldShields(actor) {
  const out = [];
  for (const item of actor?.items ?? []) {
    if (item?.type !== "armor" || !item.system?.equipped) continue;
    const sh = fieldModeEffects(item).shield;
    if (!sh) continue;
    const suit = fieldSuitFor(item);
    out.push({
      armorId: item.id,
      name: `Защитное поле (${suit?.label ?? item.name})`,
      ratingMax: Number(sh.ratingMax) || 0,
      overload: Number(sh.overload) || 0
    });
  }
  return out;
}

/** Встроенные щиты полей, что сейчас висят на акторе. */
export function armorFieldShieldItems(actor) {
  return [...(actor?.items ?? [])]
    .filter(i => i?.type === "forcefield" && i.getFlag?.(NS, ARMOR_FIELD_SHIELD_FLAG));
}

/**
 * План сверки: что создать и что снять. Чистая функция — сама запись в
 * syncArmorFieldShields ниже.
 */
export function armorFieldShieldPlan(actor) {
  const want = desiredArmorFieldShields(actor);
  const have = armorFieldShieldItems(actor);
  const wantIds = new Set(want.map(w => w.armorId));
  const haveIds = new Set(have.map(i => i.getFlag(NS, ARMOR_FIELD_SHIELD_FLAG)));
  return {
    create: want.filter(w => !haveIds.has(w.armorId)),
    remove: have.filter(i => !wantIds.has(i.getFlag(NS, ARMOR_FIELD_SHIELD_FLAG))).map(i => i.id)
  };
}

/** Приводит встроенные щиты полей в соответствие с надетой бронёй. */
export async function syncArmorFieldShields(actor) {
  if (!actor?.isOwner) return;
  const { create, remove } = armorFieldShieldPlan(actor);
  if (remove.length) await actor.deleteEmbeddedDocuments("Item", remove);
  if (!create.length) return;
  await actor.createEmbeddedDocuments("Item", create.map(w => ({
    name: w.name,
    type: "forcefield",
    img: "systems/warhammer-dbc/assets/item-icons/forcefield.svg",
    system: {
      shieldNature: "technological", shieldType: "dome",
      ratingMin: 1, ratingMax: w.ratingMax, overloadThreshold: w.overload,
      currentRating: w.ratingMax, isSpecialRating: false,
      equipped: true, status: "active", quality: "common", availability: 0, weight: 0
    },
    flags: { [NS]: { [ARMOR_FIELD_SHIELD_FLAG]: w.armorId } }
  })));
}

// module/combat/trait-shield.mjs
// ════════════════════════════════════════════════════════════════════════
//  ВСТРОЕННЫЙ ЩИТ ЧЕРТЫ — щит, который даёт сама Черта, без предмета-
//  генератора: «Даёт не перегружающийся щит-купол с рейтингом 1-50».
//
//  Пока Черта на акторе, у него лежит предмет-щит (type forcefield) с меткой
//  этой Черты; Черту сняли — снимается и щит. Дальше его читает обычный
//  конвейер щитов (combat/shield.mjs, combat/damage.mjs): бросок d100 при
//  попадании, Пила и прочие «игнорирует щиты-купола» — как у любого купола.
//
//  Источники (TRAIT_SHIELDS):
//   • Shield of Rubric / Щит Рубрики (Колдун Рубрики) — чародейский купол
//     1-50 (Sahara 1-54b9; раньше жил в combat/rubric-sorcerer.mjs);
//   • Fleshmetal Body / Тело Из Плотеметалла (Облитератор) — «не
//     перегружающийся силовой щит-купол 1-50» (Sahara 576-51a6). Книга не
//     говорит «чародейский», поэтому природа — технологическая.
//
//  Сверку зовёт хук createItem/deleteItem (hooks.mjs) только у клиента,
//  внёсшего правку.
// ════════════════════════════════════════════════════════════════════════

import { hasShieldOfRubric, SHIELD_FLAG as RUBRIC_FLAG, SHIELD_RATING as RUBRIC_RATING } from "../rules/rubric-sorcerer.mjs";
import { hasFleshmetalBody, FLESHMETAL_SHIELD_FLAG, FLESHMETAL_SHIELD_RATING } from "../rules/obliterator-talents.mjs";

const NS = "warhammer-dbc";
const FORCEFIELD_IMG = "systems/warhammer-dbc/assets/item-icons/forcefield.svg";

/** Черты со встроенным щитом. flag — метка предмета-щита, has — есть ли Черта у актора. */
export const TRAIT_SHIELDS = Object.freeze([
  { flag: RUBRIC_FLAG, name: "Shield of Rubric / Щит Рубрики", nature: "warp",
    rating: RUBRIC_RATING, has: hasShieldOfRubric },
  { flag: FLESHMETAL_SHIELD_FLAG, name: "Fleshmetal Shield / Щит Плотеметалла", nature: "technological",
    rating: FLESHMETAL_SHIELD_RATING, has: hasFleshmetalBody }
]);

export const traitShieldSpec = flag => TRAIT_SHIELDS.find(s => s.flag === flag) ?? null;

/** Данные встроенного щита: купол 1-rating, не перегружается, включён. */
export function traitShieldData(spec) {
  return {
    name: spec.name,
    type: "forcefield",
    img: FORCEFIELD_IMG,
    system: {
      shieldNature: spec.nature, shieldType: "dome",
      ratingMin: 1, ratingMax: spec.rating, overloadThreshold: 0,
      currentRating: spec.rating, isSpecialRating: false,
      equipped: true, status: "active", quality: "common", availability: 0, weight: 0
    },
    flags: { [NS]: { [spec.flag]: true } }
  };
}

const flaggedShields = (actor, flag) => [...(actor?.items ?? [])]
  .filter(i => i?.type === "forcefield" && (i.getFlag?.(NS, flag) ?? i.flags?.[NS]?.[flag]));

/** Что сделать со щитами одной Черты: создать, если Черта есть, а щита нет; снять лишнее. */
export function traitShieldPlan(actor, spec) {
  const have = flaggedShields(actor, spec.flag);
  if (spec.has(actor)) return { create: have.length ? 0 : 1, remove: have.slice(1).map(i => i.id) };
  return { create: 0, remove: have.map(i => i.id) };
}

/** Есть ли актору что сверять: Черта со щитом или уже лежащий встроенный щит. */
export const needsTraitShieldSync = actor =>
  TRAIT_SHIELDS.some(spec => spec.has(actor) || flaggedShields(actor, spec.flag).length > 0);

const queue = new Map();

/**
 * Приводит встроенные щиты актора в соответствие с его Чертами. Вызовы по
 * одному актору идут строго по очереди: архетип выдаёт Черты одним
 * createEmbeddedDocuments, хуки createItem стреляют подряд, и без очереди
 * каждый из них видел бы «щитов нет» и создавал свой.
 * @param {object} actor
 * @param {object[]} [specs]  какие Черты сверять (по умолчанию — все)
 */
export function syncTraitShields(actor, specs = TRAIT_SHIELDS) {
  if (!actor?.isOwner) return Promise.resolve();
  const key = actor.id ?? actor.uuid;
  const run = async () => {
    const remove = [], create = [];
    for (const spec of specs) {
      const plan = traitShieldPlan(actor, spec);
      remove.push(...plan.remove);
      if (plan.create) create.push(traitShieldData(spec));
    }
    if (remove.length) await actor.deleteEmbeddedDocuments("Item", remove);
    if (create.length) await actor.createEmbeddedDocuments("Item", create);
  };
  const next = (queue.get(key) ?? Promise.resolve()).then(run, run);
  queue.set(key, next);
  return next.finally(() => { if (queue.get(key) === next) queue.delete(key); });
}

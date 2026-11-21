// module/rules/warp-talon-talents.mjs
// ════════════════════════════════════════════════════════════════════════
//  Таланты и Черты Когтя Варпа — чистая логика (Foundry-сторона —
//  combat/warp-talon-talents.mjs).
//
//  «В Варпе» = Черта Veil Render / Разрыватель Завесы включена «до конца боя
//  или сцены» (rules/item-activation.mjs): пока включена, её запись Конструктора
//  с условием «Когда включено» выдаёт Unnatural Senses (P). Выход — та же
//  кнопка, бесплатно.
//  Vulture / Стервятник — пул «vulture» (½Cor.b, окр.▲), тратится только
//  Разрывателем Завесы (кнопка сама предлагает: Очко Бесчестия или Стервятник).
//  Rift / Разлом — вместо входа детонировать разрыв: ½Cor.b d10 E, Pen 10 всем
//  в радиусе Cor.b м без Daemonic; две одинаковые 6/7/8/9 — 1d5 демонов.
//  Warp Flash / Варп Вспышка — на входе и выходе все в радиусе Cor.b м: P+0
//  или Ослеплены (1 Раунд ≈ «до конца его следующего Хода»).
//  Warp Trail / Варп-След — Awareness−30, +5×PR цели-псайкера.
// ════════════════════════════════════════════════════════════════════════

import { hasItemNamed } from "./req-atom.mjs";
import { isItemActivated } from "./item-activation.mjs";
import { halfCorB } from "./astartes-elite-common.mjs";

export const VULTURE_POOL = "vulture";
export const VEIL_RENDER_NAME = "Veil Render";

/** Cor.b — радиус Разлома и Варп Вспышки, м. */
export function corBonus(actor) {
  return Math.max(0, Number(actor?.system?.corruptionBonus) || 0);
}

/** Черта Разрыватель Завесы актора (или null). */
export function veilRenderItem(actor) {
  return [...(actor?.items ?? [])].find(i => i?.type === "trait" && String(i.name ?? "").startsWith(VEIL_RENDER_NAME)) ?? null;
}

/** Находится ли Коготь Варпа в Варпе (Разрыватель Завесы включён). */
export function inWarp(actor) {
  const item = veilRenderItem(actor);
  return !!item && isItemActivated(item);
}

/** Число d10 урона Разлома: ½Cor.b (окр.▲), не меньше 1. */
export function riftDice(actor) {
  return Math.max(1, halfCorB(actor));
}

const RIFT_DAEMONS = { 6: "Демонетки", 7: "Чумоносцы", 8: "Кровопускатели", 9: "Ужасы" };

/**
 * Призыв Разлома: на броске урона выпали две (и больше) шестёрки, семёрки,
 * восьмёрки или девятки. Несколько пар — по каждой своя группа.
 * @param {number[]} faces  грани d10 броска урона
 * @returns {{face:number, daemon:string}[]}
 */
export function riftSummons(faces) {
  const count = new Map();
  for (const f of faces ?? []) count.set(Number(f), (count.get(Number(f)) ?? 0) + 1);
  return Object.entries(RIFT_DAEMONS)
    .filter(([face]) => (count.get(Number(face)) ?? 0) >= 2)
    .map(([face, daemon]) => ({ face: Number(face), daemon }));
}

/** Цель Разлома: не Daemonic. */
export function riftHits(actor) {
  return !!actor && !hasItemNamed(actor, "Daemonic", ["trait"]);
}

/** Психорейтинг актора (0 — не псайкер). */
export function psyRatingOf(actor) {
  return Math.max(0, Number(actor?.system?.psyker?.rating) || 0);
}

/** Модификатор Варп-Следа: −30, +5×PR цели-псайкера. */
export function warpTrailMod(target) {
  return -30 + 5 * psyRatingOf(target);
}

/**
 * Чем можно оплатить Разрыватель Завесы: Очко Бесчестия и/или очко Стервятника.
 * @returns {{id:"infamy"|"vulture", label:string}[]}
 */
export function veilRenderPayOptions({ infamy = 0, vulture = 0 } = {}) {
  const out = [];
  if (infamy > 0) out.push({ id: "infamy", label: `Очко Бесчестия (осталось ${infamy})` });
  if (vulture > 0) out.push({ id: "vulture", label: `Очко Стервятника (осталось ${vulture})` });
  return out;
}

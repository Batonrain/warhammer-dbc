// module/rules/stuff-of-nightmares.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Stuff of Nightmares / Существо из Кошмаров (Трейт, корбук): «Иммунитет к
//  Усталости, ядам, болезням, радиации, экстремальным температурам, вакууму,
//  Кровотечению и Обескровливанию; не может быть Оглушён, не стареет…».
//
//  Каждый иммунитет — отдельная подсистема, и здесь только опознание Трейта для
//  тех, что уже умеют спросить «есть ли иммунитет»: болезни
//  (rules/disease-immunity.mjs) и вакуум с Взрывной Декомпрессией
//  (rules/vacuum.mjs). Остальные иммунитеты Трейта — текстом, см. заметку в
//  паке и ключ trait.stuffOfNightmares в constants/capabilities.mjs.
//
//  Опознание по ключу Возможности ИЛИ по названию (rules/item-marker.mjs::itemIs):
//  копии Трейта на демонах бестиария сняты со старого состояния пака и записи
//  Механики не несут — по имени они опознаются так же, как по ключу.
//
//  Файл читает только item-marker.mjs и в граф sources.mjs не входит.
// ════════════════════════════════════════════════════════════════════════════

import { itemIs } from "./item-marker.mjs";

export const STUFF_OF_NIGHTMARES_CAP = "trait.stuffOfNightmares";

/** Этот предмет — Трейт «Stuff of Nightmares»? */
export const isStuffOfNightmares = item =>
  itemIs(item, "trait", STUFF_OF_NIGHTMARES_CAP, "Stuff of Nightmares");

/**
 * Есть ли у актора Трейт.
 * @param {(item: object) => boolean} [isActive] активность носителя (по умолчанию — любой активен)
 */
export function hasStuffOfNightmares(actor, isActive = () => true) {
  return [...(actor?.items ?? [])].some(i => isStuffOfNightmares(i) && isActive(i));
}

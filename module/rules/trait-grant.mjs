// module/rules/trait-grant.mjs
// ════════════════════════════════════════════════════════════════════════
//  Что запись «Черта» Конструктора (kind:"trait") передаёт выданной Черте
//  помимо рейтинга — флаги, которые читают уже на самой Черте.
//
//  integralChosen — книжный формат «Deadly Natural Weapons (X, Y), где Y —
//    конкретный тип естественного оружия» (core.json, «Трейты»). Раса или
//    мутация, назвавшая Y, выбирает атаки сама: запись несёт массив id
//    записей integralAttack Черты, и тот же флаг, что пишет окно с галочками
//    (rules/integral-rating.mjs::INTEGRAL_CHOSEN_FLAG), ложится на Черту
//    сразу — окно «Какие атаки есть у существа?» больше не спрашивает.
//    Гарпия: «Deadly Natural Weapons (2, Когти.Р (на руках и ногах))».
//
//  ratingFormula — рейтинг, заданный формулой («ag*2» = A.b×2). В поле
//    system.rating ложится число на момент выдачи, но раса выдаётся на
//    Этапе 1 Мастера, ДО Характеристик Этапа 2 и до Unnatural Agility из той
//    же расы, — число устаревает сразу. Читатель, которому нужна живая
//    величина (скорость полёта, rules/flight-speed.mjs), берёт формулу.
//
//  Без Foundry: только данные записи.
// ════════════════════════════════════════════════════════════════════════

import { INTEGRAL_CHOSEN_FLAG } from "./integral-rating.mjs";
import { RATING_FORMULA_FLAG } from "./flight-speed.mjs";

const PLAIN_NUMBER = /^\s*-?\d+(\.\d+)?\s*$/;

/**
 * Флаги warhammer-dbc для Черты, выдаваемой записью `entry`.
 * @returns {object} пустой объект, если передавать нечего
 */
export function grantedTraitFlags(entry) {
  const out = {};
  if (entry?.kind !== "trait") return out;
  if (Array.isArray(entry.integralChosen) && entry.integralChosen.length)
    out[INTEGRAL_CHOSEN_FLAG] = [...entry.integralChosen];
  const r = entry.rating;
  if (typeof r === "string" && r.trim() !== "" && !PLAIN_NUMBER.test(r))
    out[RATING_FORMULA_FLAG] = r.trim();
  return out;
}

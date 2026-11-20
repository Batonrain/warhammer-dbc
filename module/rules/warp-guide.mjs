// module/rules/warp-guide.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Раздел «Проводники» (Книга Пустоты v.2, гл. «Варп-путешествия», wdbc-r0w9,
//  packs-src/books/void.json entries[14].pages «Проводники») — кто ведёт
//  судно через варп кроме навигатора, и какие правки это несёт.
//
//  Навигатор — базовые правила, без штрафов/бонусов (guideKindFor вернёт
//  "navigator", а все guideXxx-функции ниже отдают 0/false на этот ключ).
//  Психоактивные люди/астартес — штраф к навигации, бонус к столкновениям,
//  доп. Порча+Усталость за 10 дней. Демоны/одержимые-в-демоническом-режиме —
//  двойной бросок столкновений (МИ выбирает результат — не наша функция,
//  просьба книги буквально «выбирает», не «берёт худший»), доп. штраф к
//  Выходу, возможен встречный тест лояльности (не автоматизируется — за
//  столом). Одержимый с даром Рулевой (Helmsman) — «во всех правилах
//  считается Навигатором», поэтому он классифицируется как "navigator", а
//  не "possessed".
//
//  Чистая логика без Foundry (только чтение actor.system/actor.items) —
//  обвязка (кнопки, чат-карточки) в module/apps/veil.mjs.
// ════════════════════════════════════════════════════════════════════════════

import { isPossessed, hasEliteArchetype } from "./predicates.mjs";
import { hasAbility } from "./ability-by-key.mjs";

export const GUIDE_KINDS = {
  navigator:    { label: "Навигатор" },
  psychoactive: { label: "Психоактивный (не навигатор)" },
  daemon:       { label: "Демон" },
  possessed:    { label: "Одержимый" },
  demonPrince:  { label: "Принц Демона" }
};

/**
 * Кем этот актор выступает в роли Проводника — ключ GUIDE_KINDS, либо null,
 * если он вообще не годится ни по одному правилу раздела «Проводники».
 */
export function guideKindFor(actor) {
  if (!actor) return null;
  if (actor.type === "demonPrince") return "demonPrince";
  if (actor.type === "daemon") return "daemon";
  if (actor.type !== "character") return null;
  const sys = actor.system || {};
  if (isPossessed(actor)) {
    // «Если одержимый обладает даром Рулевой, он считается во всех правилах Навигатором.»
    if (hasAbility(actor, "", "Helmsman", "talent")) return "navigator";
    return "possessed";
  }
  if (sys.subrace === "navigator") return "navigator";
  const psychic = !!sys.isPsyker || hasEliteArchetype(actor, "Чернокнижник");
  if (psychic && (sys.race === "human" || sys.race === "astartes")) return "psychoactive";
  return null;
}

/** −20 на ВСЕ тесты навигации в варпе (Шаги 4-5) для психоактивных Проводников. */
export function guideNavPenalty(kind) {
  return kind === "psychoactive" ? -20 : 0;
}

/**
 * Доп. штраф к Выходу из варпа (Шаг 5) — демоны всегда, одержимые в
 * демоническом режиме (человеческая часть НЕ подключена к навигации).
 * Складывается с обычным −20 Шага 5, а не заменяет его.
 */
export function guideExitPenalty(kind, possessedHumanCoNav = false) {
  if (kind === "daemon") return -30;
  if (kind === "possessed" && !possessedHumanCoNav) return -30;
  return 0;
}

/** +10 к броскам по Таблице Варп-столкновений для психоактивных Проводников
 *  (правка Н1 — раньше в книге по ошибке было записано как штраф). */
export function guideEncounterBonus(kind) {
  return kind === "psychoactive" ? 10 : 0;
}

/**
 * Демоны (и одержимые без человеческого соучастия) бросают по Таблице
 * Варп-столкновений ДВАЖДЫ, а МИ выбирает результат — это не модификатор
 * числа, а другой розыгрыш целиком, поэтому отдельная функция, а не число.
 */
export function guideRollsEncounterTwice(kind, possessedHumanCoNav = false) {
  return kind === "daemon" || (kind === "possessed" && !possessedHumanCoNav);
}

/**
 * Доп. надбавка за каждые 10 дней навигации — СВЕРХ общей книжной Усталости
 * Проводника (которая идёт за каждый тест Navigation(Warp), см.
 * module/apps/veil.mjs::_applyGuideFatigue). Психоактивный получает и Порчу,
 * и лишнюю Усталость; одержимый с человеческим соучастием — только Порчу.
 */
export function guideDecadeUpkeep(kind, possessedHumanCoNav = false) {
  if (kind === "psychoactive") return { corruption: 1, fatigue: 1 };
  if (kind === "possessed" && possessedHumanCoNav) return { corruption: 1, fatigue: 0 };
  return { corruption: 0, fatigue: 0 };
}

/** Нужен ли встречный тест лояльности демона перед странствием (МИ решает
 *  сам, вести его или нет — этот флаг только говорит, что правило применимо). */
export function guideNeedsLoyaltyCheck(kind) {
  return kind === "daemon" || kind === "possessed";
}

/**
 * Встречный тест лояльности демона-Проводника (wdbc-dq0r4): три варианта книги.
 *   «inf»     — наибольшая Inf персонажей против Inf демона;
 *   «wp»      — W против W, если демон сломлен и принуждён служить;
 *   «loyalty» — тест Лояльности демона, если он Миньон (без встречной стороны).
 * Режим по умолчанию: Миньон (есть Хозяин) — «loyalty», иначе «inf»; сломлен ли
 * демон, система не знает — это выбирает ГМ в окне.
 * @param {object} guide  актор Проводника
 * @returns {"inf"|"wp"|"loyalty"}
 */
export function guideLoyaltyDefaultMode(guide) {
  return guide?.system?.masterUuid && guide?.system?.loyalty ? "loyalty" : "inf";
}

/**
 * Исход встречного теста лояльности. `party` — {value, rv} стороны персонажей,
 * `guide` — {value, rv} демона. Степени — как у testOutcome, ничья — у кого
 * выше Порог (общее правило встречных тестов); при равных Порогах — у демона нет
 * победы (саботажа нет).
 * @returns {{loyal:boolean, partyDeg:number, guideDeg:number}}
 */
export function resolveGuideLoyalty(mode, party, guide) {
  const signed = ({ value, rv }) => rv <= value ? 1 + Math.floor((value - rv) / 10) : -(1 + Math.floor((rv - value) / 10));
  if (mode === "loyalty") {
    const g = signed(guide);
    return { loyal: g > 0, partyDeg: 0, guideDeg: g };
  }
  const p = signed(party), g = signed(guide);
  const loyal = p !== g ? p > g : (Number(party.value) || 0) >= (Number(guide.value) || 0);
  return { loyal, partyDeg: p, guideDeg: g };
}

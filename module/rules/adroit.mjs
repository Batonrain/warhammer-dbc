// module/rules/adroit.mjs
// ════════════════════════════════════════════════════════════════════════
//  Adroit / Искусный — Черта Ренегата (корбук, глава I, Архетипы Людей).
//  [книга] «При создании персонажа, Ренегат выбирает одну Характеристику
//  (кроме Inf и Cor). Все успешные тесты на эту Характеристику (в т.ч. тесты
//  на навыки через эту Характеристику) получают +1 Успех».
//
//  Выбор хранится флагом на самой Черте (`flags.warhammer-dbc.adroitChar`):
//  снимут Черту — уйдёт и выбор, второго места правды нет. Спрашивается
//  диалогом при получении Черты (apps/adroit.mjs, хук createItem).
//  Читают — rules/kind-outcome.mjs (тесты Навыков/Характеристик, Страх,
//  верховые), combat/attack.mjs (атака WS/BS), combat/defense.mjs
//  (Уклонение A, Парирование WS). Foundry здесь не нужен.
// ════════════════════════════════════════════════════════════════════════

import { CHARACTERISTICS } from "../constants/characteristics.mjs";

/** Возможность, которую выдаёт Черта (kind:"capability" на её Конструкторе). */
export const ADROIT_FLAG = "trait.adroit";
/** Флаг выбора на предмете-Черте. */
export const ADROIT_CHAR_FLAG = "adroitChar";

/**
 * Характеристики на выбор: все, кроме Inf. Порча (Cor) в этой системе не
 * Характеристика листа (CHARACTERISTICS её не содержит) — исключать нечего.
 */
export const ADROIT_CHOICES = Object.keys(CHARACTERISTICS).filter(k => k !== "inf");

const flagOf = item => item?.flags?.["warhammer-dbc"]?.[ADROIT_CHAR_FLAG]
  ?? item?.getFlag?.("warhammer-dbc", ADROIT_CHAR_FLAG) ?? "";

/** Предмет-Черта Искусного у актора (по флагу выбора ИЛИ по имени), либо null. */
export function adroitTraitItem(actor) {
  const items = [...(actor?.items ?? [])];
  return items.find(i => i?.type === "trait" && ADROIT_CHOICES.includes(flagOf(i)))
    ?? items.find(i => i?.type === "trait" && /\bAdroit\b|Искусный/i.test(String(i?.name ?? "")))
    ?? null;
}

/** Выбранная Характеристика ("" — Черты нет или выбор не сделан). */
export function adroitChar(actor) {
  const c = flagOf(adroitTraitItem(actor));
  return ADROIT_CHOICES.includes(c) ? c : "";
}

/**
 * +1 Успех к успешному тесту на выбранную Характеристику.
 * @param {object}  actor
 * @param {string}  charKey Характеристика, которой реально бросали
 * @param {boolean} success
 * @returns {0|1}
 */
export function adroitDegreeBonus(actor, charKey, success) {
  if (!success || !charKey) return 0;
  return adroitChar(actor) === charKey ? 1 : 0;
}

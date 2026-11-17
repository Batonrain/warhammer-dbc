// module/rules/execution.mjs
// ════════════════════════════════════════════════════════════════════════════
//  ЧЕРТА «КАЗНЬ» / Execution (Мастер Казней, Элитный Архетип; Sahara fear-2, решение владельца 30.10.2026).
//
//  Книга: «Когда Мастер Казней вооружен двуручным рукопашным оружием в двуручном хвате и совершает им атаку
//  по достойной трофейной цели, если он не убил ее этой атакой, он может совершить по ней еще одну атаку тем
//  же оружием с той же базой и приемом Обычная Атака. Если Inf цели (или аналог для не-Хаоситов) 30-59, он
//  может таким образом атаковать ее до 2-х дополнительных раз, 60-79 – до 3-х, а 80+ – до 4-х. Он может
//  совершать Казнь только один раз в Раунд.»
//
//  Чистая логика (без Foundry): кто носитель, сколько дополнительных атак даёт Inf, годится ли оружие и хват,
//  жива ли серия Раунда. Кнопка на карточке атаки, диалог ГМа «достойна ли цель» и бесплатное окно атаки —
//  combat/execution.mjs. «Не убил» = у цели не констатирована смерть (sheets/tabs/body.mjs::setDeceased —
//  единственная точка, где система признаёт смерть; то же решение владельца, что у Жнеца 26.10.2026).
//
//  Модуль НЕ импортирует hasRuleFlag/collect: его зовёт combat-слой, а круг через rules/sources.mjs
//  вешает загрузку (AGENTS.md).
// ════════════════════════════════════════════════════════════════════════════

import { itemHasName } from "./predicates.mjs";
import { parseGrips } from "../constants/combat.mjs";

/** Ключ двуручного хвата (constants/combat.mjs::GRIPS). */
const TWO_HANDED = "2р";

/** Носитель — Черта «Execution / Казнь» (Талант-тёзка «Окончательная Казнь» и «Полевая Казнь» — другое). */
export function hasExecution(actor) {
  return [...(actor?.items ?? [])].some(i =>
    i?.type === "trait" && (itemHasName(i, "Execution") || itemHasName(i, "Казнь")));
}

/**
 * Сколько дополнительных атак даёт цель по её Inf. Книга сперва даёт «еще одну атаку», а Inf 30–59 поднимает
 * потолок до 2, 60–79 — до 3, 80+ — до 4; ниже 30 остаётся одна (ревью fear-2: иначе достойная цель с малым Inf
 * или без характеристики — чудовище из бестиария — оставалась бы без Казни вовсе). Нечисло — 0.
 */
export function executionExtraAttacks(inf) {
  const n = Number(inf);
  if (!Number.isFinite(n)) return 0;
  if (n >= 80) return 4;
  if (n >= 60) return 3;
  if (n >= 30) return 2;
  return 1;
}

/**
 * «Двуручное рукопашное оружие в двуручном хвате»: основной хват оружия — «2р» (так записаны двуручные мечи
 * «2р (1р)»; «1р (2р)» — одноручное оружие, перехваченное двумя руками) и в атаке выбран именно «2р».
 * @param {object} weapon  Предмет-оружие
 * @param {string} gripKey выбранный в окне атаки хват
 */
export function isExecutionWeapon(weapon, gripKey) {
  if (!weapon || weapon.system?.weaponClass !== "melee") return false;
  return parseGrips(weapon.system?.grips)[0] === TWO_HANDED && String(gripKey ?? "") === TWO_HANDED;
}

/**
 * Серия Казни жива: запись (флаг актора) из этого же боя и этого же Раунда. Вне боя Раундов нет — серии нет.
 * @param {?{combatId:string, round:number}} rec
 * @param {?{id:string, round:number}} combat
 */
export function executionSeriesLive(rec, combat) {
  return !!rec && !!combat?.id && rec.combatId === combat.id && Number(rec.round) === (Number(combat.round) || 0);
}

/**
 * Можно ли сделать ещё одну атаку Казни: вердикт и сколько их останется ДО этой атаки.
 * @param {{series:?object, combat:?object, targetUuid:string, total?:number}} o
 *   total — положенное число доп. атак по Inf цели (нужно на старте; у живой серии оно уже записано)
 * @returns {{ok:boolean, left?:number, total?:number, reason?:string}}
 */
export function executionStepVerdict({ series, combat, targetUuid, total = 0 } = {}) {
  if (!combat?.id) return { ok: false, reason: "Казнь — раз в Раунд, а вне боя Раундов нет." };
  if (executionSeriesLive(series, combat)) {
    if (series.targetUuid !== targetUuid) return { ok: false, reason: "Казнь только раз в Раунд — в этом Раунде она уже идёт по другой цели." };
    const left = (Number(series.total) || 0) - (Number(series.used) || 0);
    if (left <= 0) return { ok: false, reason: "дополнительные атаки Казни по этой цели исчерпаны." };
    return { ok: true, left, total: Number(series.total) || 0 };
  }
  const n = Math.max(0, Number(total) || 0);
  if (n <= 0) return { ok: false, reason: "дополнительных атак Казни не положено." };
  return { ok: true, left: n, total: n };
}

// module/rules/legion-surgery.mjs
// ════════════════════════════════════════════════════════════════════════
//  Legion Surgery / Хирургия Легиона — Черта Архетипа Апотекарий.
//  Книга: «Когда Апотекарий проваливает любой тест на лечение или работу с
//  геносеменем, он может потратить Очко Бесчестия, чтобы автоматически
//  пройти этот тест с 1 Успехом. Если он Первой помощью поднял Раны
//  вошедшего в Замедленную Анимацию десантника до хотя бы –7, Апотекарий
//  может потратить 1 Очко Бесчестия, чтобы пробудить его из анабиоза.»
//
//  Чистая часть. Читатели:
//   - sheets/tabs/healing.mjs — каждый тест Medicae окна Лечения (Первая
//     Помощь, уход, ампутация, операции…): при провале спрашивает медика;
//   - hooks.mjs, меню Очков на карточке теста Навыка — провал Medicae или
//     Forbidden Lore (Astartes Implants), брошенный с листа;
//   - sheets/tabs/healing.mjs, после Первой Помощи — пробуждение.
// ════════════════════════════════════════════════════════════════════════

import { hasRuleFlag } from "./flags.mjs";

export const LEGION_SURGERY = "trait.legionSurgery";

/** «до хотя бы –7»: Критических (Отрицательных) Ран не больше 7. */
export const SUS_AN_WAKE_MAX_CRITICAL = 7;

/** Метка «лежит в Замедленной Анимации» — ставит sheets/tabs/death.mjs::doSusAnimation. */
export const SUS_AN_ACTIVE_FLAG = "susAnActive";

const NS = "warhammer-dbc";

export function hasLegionSurgery(actor) {
  return !!actor && hasRuleFlag(actor, LEGION_SURGERY);
}

/**
 * Тест Навыка с листа — «на лечение или работу с геносеменем»: любой
 * Medicae; Forbidden Lore (Astartes Implants) — знание, которым работают с
 * имплантами и геносеменем (книга, «Замедленная Анимация»: «медик с
 * For.Lore (Astartes Implants)»). [допущение] Прочие Навыки — нет.
 * @param {{skill?:string, group?:string, specialty?:string}} ctx rollContext теста
 */
export function legionSurgeryTestEligible({ skill = "", group = "", specialty = "" } = {}) {
  if (skill === "medicae") return true;
  if (group === "forbiddenLore") return /astartes\s*implants|импланты\s*астартес/i.test(String(specialty));
  return false;
}

/** Провал, Черта есть — можно предложить трату Очка. */
export function legionSurgeryCanRescue(medic, success) {
  return !success && hasLegionSurgery(medic);
}

/** Пациент лежит в Замедленной Анимации: метка стоит и он без сознания. */
export function inSuspendedAnimation(patient) {
  const flag = patient?.getFlag?.(NS, SUS_AN_ACTIVE_FLAG) ?? patient?.flags?.[NS]?.[SUS_AN_ACTIVE_FLAG];
  return !!flag && !!patient?.system?.conditions?.unconscious;
}

/**
 * Можно ли пробудить: пациент в Замедленной Анимации и его Раны не ниже −7
 * (wounds.critical — число Отрицательных Ран, положительное).
 */
export function susAnWakeEligible(patient) {
  const crit = Number(patient?.system?.wounds?.critical) || 0;
  return inSuspendedAnimation(patient) && crit <= SUS_AN_WAKE_MAX_CRITICAL;
}

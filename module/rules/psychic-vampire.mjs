// module/rules/psychic-vampire.mjs
// ════════════════════════════════════════════════════════════════════════════
//  ПСИХИЧЕСКИЙ ВАМПИР / Psychic Vampire (Талант Псайканы, Sahara 3-28, пачка I2,
//  решение владельца 26.10.2026: «кнопка на карточке урона»).
//
//  Книга: «Раз в Раунд когда он убивает обладающее душой существо (но не когда изгоняет
//  демона в Варп) с помощью психосилы или психосилового оружия, персонаж может пройти
//  психотест через W+0 и при Успехе вылечить себе 1d5 Ран или снять всю Усталость. Успешное
//  применение этого Таланта считается как применение наркотика, и может вызывать зависимость:
//  Зависимость: 6 | W+0 | 6 дней | Персонаж получает ментальное расстройство Агрессия на
//  тяжести 2.»
//
//  Как собрано (ничего нового для зависимости не изобретается):
//   • кнопка рисуется в карточке урона (combat/damage.mjs), когда у атакующего есть Талант,
//     урон психический (сила либо оружие со свойством «Психосиловое»/Force), непоглощённый урон
//     прошёл и цель вышла из строя (Раны ≤ 0) — тем же признаком, что Разрубить;
//   • «обладает ли душой» и «не изгнание ли демона» — вопрос игроку в момент клика (как галочка
//     «Бездушный» окна атаки Перемены): система не знает, у кого есть душа;
//   • успешное применение — доза «наркотика» по недельному счётчику (sheets/tabs/drugs.mjs::
//     weeklyDoseCheck): на шестой за неделю — тест Зависимости W+0, провал даёт зависимость с
//     частотой 6 дней, штраф и срыв — те же, что у настоящих наркотиков (флаг актора
//     drugWithdrawal). Расстройство «Агрессия» тяжести 2 (I4, решение владельца 27.10.2026) выдают
//     сразу при возникновении зависимости и держат до её срыва (I5; новая доза не снимает), — настройка `penaltyDisorder` в VAMPIRE_ADDICTION
//     ниже и combat/drug-withdrawal.mjs::syncWithdrawalDisorders; общей подсистемы расстройств у
//     зависимостей нет — это поле читает только эта пара функций.
//
//  Чистый модуль без Foundry; Foundry-обвязка — combat/psychic-vampire.mjs.
// ════════════════════════════════════════════════════════════════════════════

import { itemHasName } from "./predicates.mjs";

/** Лечение: «вылечить себе 1d5 Ран». */
export const VAMPIRE_HEAL_FORMULA = "1d5";
/** Ключ метки «раз в Раунд» (rules/cooldown.mjs) — тот же, что у записи-возможности в реестре. */
export const VAMPIRE_USAGE_KEY = "psyker.core.psychicVampire";
/** Название «препарата» — ключ записи зависимости в флаге актора (rules/drug-withdrawal.mjs::drugKey). */
export const VAMPIRE_DRUG_NAME = "Психический Вампир";

/**
 * «Зависимость: 6 | W+0 | 6 дней | Агрессия 2» — настройки в том же формате, что у препарата
 * (module/data/item/drug.mjs → addiction): minDose — доз в неделю до теста, testChar/testMod —
 * тест, frequency — частота приёма, penalty — текст штрафа без дозы.
 */
export const VAMPIRE_ADDICTION = Object.freeze({
  hasAddiction: true,
  minDose: 6,
  testChar: "wp",
  testMod: 0,
  testChar2: "",
  testMod2: 0,
  frequency: "6 дней",
  penalty: "Ментальное расстройство Агрессия тяжести 2",
  penaltyMods: "",
  // Расстройство выдаётся само сразу при возникновении зависимости (rules/drug-withdrawal.mjs::withdrawalDisorders,
  // combat/drug-withdrawal.mjs::syncWithdrawalDisorders) и снимается только срывом зависимости. Своя «Агрессия»
  // игрока не дублируется: её тяжесть поднимается на severity и после срыва возвращается.
  penaltyDisorder: Object.freeze({ name: "Агрессия", severity: 2 }),
  breakMod: 0,
  periodCharDamage: Object.freeze({ stat: "", formula: "" }),
  blocksRecovery: ""
});

/** «Препарат»-двойник: предмет-образ, которым питаются функции препаратов (не создаётся в мире). */
export function vampireDrug() {
  return { id: null, name: VAMPIRE_DRUG_NAME, type: "drug", system: { addiction: VAMPIRE_ADDICTION }, flags: {} };
}

const isVampire = i => itemHasName(i, "Psychic Vampire") || itemHasName(i, "Психический Вампир");
export function hasPsychicVampire(actor) {
  return [...(actor?.items ?? [])].some(i => i?.type === "talent" && isVampire(i));
}

/**
 * Урон нанесён «психической мощью»: психосилой (карточка урона несёт тип силы, пустая строка —
 * тоже сила) либо психосиловым оружием (свойство «Психосиловое» / Force).
 */
export function isPsychicDamage({ psychicPowerType = null, weapon = null } = {}) {
  if (psychicPowerType != null) return true;
  return (weapon?.system?.weaponProps ?? []).some(p => p?.key === "force");
}

/** Рисовать ли кнопку Таланта на карточке урона. */
export function vampireOffered(attacker, { psychicPowerType = null, weapon = null, net = 0, woundsAfter = 1 } = {}) {
  if (!hasPsychicVampire(attacker)) return false;
  if (!isPsychicDamage({ psychicPowerType, weapon })) return false;
  return (Number(net) || 0) > 0 && (Number(woundsAfter) || 0) <= 0;
}

const WHY = {
  round: "Психический Вампир: раз в Раунд — в этом Раунде уже использовано.",
  "no-soul": "Психический Вампир: у цели нет души (или это изгнание демона в Варп) — Талант не срабатывает.",
  "no-talent": "Психический Вампир: нет Таланта."
};
export const vampireWhy = code => WHY[code] ?? "";

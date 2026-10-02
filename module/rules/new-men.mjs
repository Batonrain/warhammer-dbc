// module/rules/new-men.mjs
// ════════════════════════════════════════════════════════════════════════════
//  New Men / Новые Люди (Йигори, корбук, глава I «Расы») — чистые правила.
//
//  Черта — восемь пунктов книги, и у каждого своя подсистема. Пункты, которые
//  система может посчитать, выданы возможностями на самой Черте (packs-src/
//  traits/New_Men…json, kind:"capability"); здесь — имена этих возможностей и
//  арифметика, места чтения — в Foundry-обвязке:
//
//   • «лечится как космодесантник» — готовая healing.astartes (sheets/tabs/
//     healing.mjs), своего кода не нужно;
//   • «иммунен ко всем болезням, даже сверхъестественным» — immunity.disease:
//     болезнь (предмет type:"disease") на лист не ложится вовсе, хук
//     preCreateItem в warhammer-dbc.mjs. Броска на заражение в системе нет —
//     болезнь ГМ кладёт предметом, и перехватить можно ровно это;
//   • «время действия яда/наркотика/медикамента вдвое (окр.▼), побочные
//     эффекты игнорирует; мгновенный/разовый эффект медикамента вдвое» —
//     newMen.drugs, sheets/tabs/drugs.mjs (applyDrug/triggerAfterEffect).
//     «Побочный эффект» — пост-эффект препарата (system.hasAfterEffect);
//   • «d20 вместо d10 на тестах Кровотечения, затянуть Кровотечение тестом
//     T+0 в начале своего Хода» — newMen.bleeding, combat/condition-ticks.mjs;
//   • «до 3-х дней без сна» — newMen.sleep: порог Сна сдвигается
//     (constants/vitals.mjs, ctx.sleepGraceDays);
//   • «штрафы Medicae к пересадке и вживлению бионики вдвое, восстановление
//     после операции вдвое» — newMen.surgery, sheets/tabs/healing.mjs
//     (Пришивание, Бионика — единственные операции, которые система бросает);
//   • «регенерация сокращает восстановление после переломов и бесполезных
//     конечностей в 4 раза» — newMen.regeneration: срок в лубке
//     (sheets/tabs/healing.mjs applySetLimb).
//
//   • «регенерирует потерянные конечности и органы» — той же newMen.regeneration:
//     глаз за 7 суток, руку/кисть/ногу/стопу за 2 месяца, бионика и потеря
//     мутацией не регенерируют (combat/limb-regen.mjs, wdbc-yffxj).
//
//  Текстом остаются: пищевые отравления (в системе нет механики яда через
//  еду), совместимость крови/органов (переливаний и пересадки органов в
//  системе нет), отращивание языка/почки/лёгкого и пальцев (в системе нет их
//  хранилища).
// ════════════════════════════════════════════════════════════════════════════

import { hasRuleFlag } from "./flags.mjs";

export const NEW_MEN = {
  diseaseImmunity: "immunity.disease",
  drugs:           "newMen.drugs",
  bleeding:        "newMen.bleeding",
  sleep:           "newMen.sleep",
  surgery:         "newMen.surgery",
  regeneration:    "newMen.regeneration"
};

/** Половина с округлением вниз, не меньше нуля; мусор — ноль. */
export function halveDown(n) {
  const v = Number(n);
  return Number.isFinite(v) && v > 0 ? Math.floor(v / 2) : 0;
}

/** Кубик теста Кровотечения: «Бросает d20 вместо d10». */
export function bleedingDieFormula(actor) {
  return actor && hasRuleFlag(actor, NEW_MEN.bleeding) ? "1d20" : "1d10";
}

/** Может ли актор затянуть своё Кровотечение тестом T+0 в начале Хода. */
export function canSelfStaunch(actor) {
  return !!actor && hasRuleFlag(actor, NEW_MEN.bleeding);
}

/** Срок действия препарата (Раунды/минуты): вдвое, окр.▼. */
export function newMenDrugDuration(actor, rounds) {
  return actor && hasRuleFlag(actor, NEW_MEN.drugs) ? halveDown(rounds) : Number(rounds) || 0;
}

/** Игнорирует ли актор побочные (пост-) эффекты препаратов. */
export function ignoresDrugSideEffects(actor) {
  return !!actor && hasRuleFlag(actor, NEW_MEN.drugs);
}

/**
 * Поля «Особых действий» препарата, которые считаются разовым ЛЕЧЕБНЫМ
 * эффектом: лечение Ран и снятие уровней Состояний. Наложение Усталости,
 * Состояния и урон — вред, а не «эффект медикамента»: книга режет вдвое
 * пользу, а не вредную сторону (вредную она гасит пунктом «побочные эффекты»).
 */
const INSTANT_MEDICINE_FIELDS = [
  "removesWounds", "removesBleedingLevels", "removesHaemorrhagingLevels",
  "removesFatigueLevels", "removesConditionLevel"
];

/**
 * «Если медикамент действует мгновенно или разово, Йигори уменьшает эффект
 * вдвое (окр.▼)» — только категория «медикамент» (drugCategory "medicine"):
 * у наркотика и яда книга режет срок, а не силу.
 * Формулу лечения (healFormula) режет вызывающий после броска — halveDown.
 * @returns {object} новый объект (исходник не трогается) или тот же fx
 */
export function newMenInstantMedicine(actor, drugCategory, fx) {
  if (!fx || drugCategory !== "medicine" || !actor || !hasRuleFlag(actor, NEW_MEN.drugs)) return fx;
  const out = { ...fx };
  for (const key of INSTANT_MEDICINE_FIELDS) if (Number(out[key]) > 0) out[key] = halveDown(out[key]);
  return out;
}

/** Режет ли актор формулу разового лечения медикамента вдвое. */
export function halvesInstantMedicine(actor, drugCategory) {
  return drugCategory === "medicine" && !!actor && hasRuleFlag(actor, NEW_MEN.drugs);
}

/** Штраф Medicae операции (Пришивание, Бионика): «обычные штрафы вдвое». */
export function newMenSurgeryPenalty(actor, penalty) {
  const p = Number(penalty) || 0;
  if (p >= 0 || !actor || !hasRuleFlag(actor, NEW_MEN.surgery)) return p;
  return -Math.floor(-p / 2);
}

/** Восстановление после операции (суток): вдвое, окр.▼, не меньше суток. */
export function newMenRecoveryDays(actor, days) {
  const d = Math.max(1, Number(days) || 1);
  return actor && hasRuleFlag(actor, NEW_MEN.surgery) ? Math.max(1, Math.floor(d / 2)) : d;
}

/** Срок в лубке после перелома (суток): вчетверо короче, не меньше суток. */
export function splintDays(actor, days) {
  const d = Math.max(1, Number(days) || 1);
  return actor && hasRuleFlag(actor, NEW_MEN.regeneration) ? Math.max(1, Math.floor(d / 4)) : d;
}

/** Не ляжет ли предмет этого типа на актора: болезнь на иммунного к болезням. */
export function diseaseCreateBlocked(actor, itemType) {
  return itemType === "disease" && !!actor && hasRuleFlag(actor, NEW_MEN.diseaseImmunity);
}

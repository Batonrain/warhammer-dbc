// module/rules/minion-loyalty.mjs
// ════════════════════════════════════════════════════════════════════════════
//  ТЕСТ ЛОЯЛЬНОСТИ МИНЬОНА (корбук, «Лояльность», стр. 113) — чистые правила.
//
//  Книга: «Когда Хозяин приказывает Миньону рисковать жизнью (участвовать в
//  бою рядом с Хозяином не считается, если тот разделяет риск), совершить
//  действие вне характера … или отправляет его на миссию вне своего контроля,
//  ГМ бросает на Лояльность Миньона. При Успехе тот выполняет то, что ему было
//  приказано, но при Провале он либо проявляет своеволие, либо не до конца
//  понимает приказ и что-то идёт не так. При Провале теста на лояльность в бою
//  ГМ перехватывает контроль над Миньоном до конца боя.»
//
//  Порог — ТЕКУЩЕЕ значение Лояльности (system.loyalty.value), а не максимум:
//  максимум — то, что идёт от Хозяина (minion-build.mjs::minionLoyalty), а
//  значение ГМ может уронить за обиды (Конструктор, запись kind:"loyalty").
//
//  Кто меняет сам тест:
//   • Monodevotant / Монозависимый (Черта Миньона): «перебрасывает неудачные
//     тесты Лояльности» — второй бросок только после провала, и он
//     окончательный (не «лучший из двух»: переброс провала успехом уже не
//     ухудшить, а провал второго броска — просто провал).
//   • Adoring Crowds / Обожание Толпы (Черта Хозяина, Воин Ноты): «Когда …
//     выводит из боя вражеского чемпиона, чудовище или машину, все видевшие
//     это его Миньоны-Люди могут потратить по Реакции и пройти тест
//     Лояльности, при Успехе восстанавливая ему Очко Бесчестия каждый» —
//     отдельный повод теста в окне, доступен только Миньону-Человеку такого
//     Хозяина.
//
//  Бросок и карточка — module/combat/minion-loyalty-test.mjs; здесь только то,
//  что проверяется без Foundry.
// ════════════════════════════════════════════════════════════════════════════

import { testOutcome } from "./roll-outcome.mjs";
import { hasAbility } from "./ability-by-key.mjs";
import { loyaltyGroupOf } from "./binary-dominion.mjs";

/** Ключи Возможностей (module/constants/capabilities.mjs) для опознания по ключу. */
export const MONODEVOTANT_CAP = "trait.monodevotant";
export const ADORING_CROWDS_CAP = "trait.elitnyeArhetipy.voinNoty.adoringCrowds";

/**
 * Поводы теста — три из книги, повод Обожания Толпы и «другое» для решения
 * ГМа. `combatFailControl` — при Провале в бою ГМ берёт Миньона на себя (книга
 * говорит это про любой тест Лояльности в бою, но у Обожания Толпы провал
 * значит лишь «Очка не будет»: Миньон не получал приказа, ослушаться нечего).
 */
export const LOYALTY_REASONS = {
  risk: {
    label: "Рискнуть жизнью",
    failText: "Миньон отказывается рисковать: проявляет своеволие или исполняет приказ так, что что-то идёт не так.",
    combatFailControl: true
  },
  character: {
    label: "Действие вне характера",
    failText: "Миньон не может переступить через себя: проявляет своеволие или исполняет приказ так, что что-то идёт не так.",
    combatFailControl: true
  },
  mission: {
    label: "Миссия вне контроля Хозяина",
    failText: "Без присмотра Миньон проявляет своеволие или не до конца понимает приказ — что-то идёт не так.",
    combatFailControl: true
  },
  adoringCrowds: {
    label: "Обожание Толпы: Хозяин сразил чемпиона, чудовище или машину",
    failText: "Восторг не дотягивает до поклонения: Очко Бесчестия Хозяину не восстановлено.",
    combatFailControl: false,
    adoringCrowds: true
  },
  other: {
    label: "Другое (на усмотрение ГМа)",
    failText: "Миньон проявляет своеволие или не до конца понимает приказ — что-то идёт не так.",
    combatFailControl: true
  }
};

/** Успех при обычном приказе — общий для всех поводов, кроме Обожания Толпы. */
export const LOYALTY_SUCCESS_TEXT = "Миньон выполняет то, что ему приказано.";

/** Текст перехвата контроля (стр. 113). */
export const LOYALTY_COMBAT_FAIL_TEXT = "Провал в бою: ГМ перехватывает контроль над Миньоном до конца боя.";

/** Монозависимый ли Миньон (переброс неудачных тестов Лояльности). */
export function hasMonodevotant(minion) {
  return hasAbility(minion, MONODEVOTANT_CAP, "Monodevotant", "trait");
}

/** Есть ли у Хозяина Обожание Толпы. */
export function hasAdoringCrowds(master) {
  return hasAbility(master, ADORING_CROWDS_CAP, "Adoring Crowds", "trait");
}

/**
 * Можно ли этому Миньону пройти тест по поводу Обожания Толпы: Хозяин с
 * Чертой и Миньон-Человек — по той же группе, от которой считается его
 * Лояльность (binary-dominion.mjs::loyaltyGroupOf: человек, отмеченный
 * Бинарной Паствой «считать как машину», уже не Человек).
 */
export function adoringCrowdsEligible(master, minion) {
  if (!master || !minion || !hasAdoringCrowds(master)) return false;
  return loyaltyGroupOf(master, minion) === "human";
}

/** Поводы, доступные в окне теста этого Миньона: [{key, label}]. */
export function loyaltyReasonOptions(master, minion) {
  return Object.entries(LOYALTY_REASONS)
    .filter(([, def]) => !def.adoringCrowds || adoringCrowdsEligible(master, minion))
    .map(([key, def]) => ({ key, label: def.label }));
}

/** Порог теста: текущая Лояльность + модификатор ГМа (книга порог не обрезает). */
export function loyaltyThreshold(minion, mod = 0) {
  return (Number(minion?.system?.loyalty?.value) || 0) + (Number(mod) || 0);
}

/**
 * Ритуал Связывания Души (Ритуалы, «Контроль»): «Цель … автоматически проходит
 * все тесты Лояльности, даже если её отправят на самоубийственные миссии».
 * Галочку «Связан душой» в шапке листа Миньона (флаг soulBound) ставит сам
 * ритуал — кнопка его карточки (combat/soul-binding.mjs); ГМ может и руками.
 */
export const SOUL_BOUND_FLAG = "soulBound";

/** Связан ли Миньон с Хозяином Ритуалом Связывания Души. */
export function isSoulBound(minion) {
  return !!minion?.flags?.["warhammer-dbc"]?.[SOUL_BOUND_FLAG];
}

/**
 * Разобрать броски теста. `values` — выпавшие d100 по порядку; второй
 * используется, только если первый провален и разрешён переброс провала.
 *
 * @param {number[]} values
 * @param {number}   threshold
 * @param {object}   [o]
 * @param {boolean}  [o.rerollFailed]  Монозависимый: перебросить провал
 * @param {boolean}  [o.autoSuccess]   Связан душой: тест засчитан успешным
 * @returns {{rv:number, success:boolean, deg:number, rerolled:boolean, first:number, usedRolls:number}}
 */
export function resolveLoyaltyRolls(values, threshold, { rerollFailed = false, autoSuccess = false } = {}) {
  const first = Number(values?.[0]) || 0;
  const firstOutcome = testOutcome(first, threshold, { autoSuccess });
  if (firstOutcome.success || !rerollFailed || values?.length < 2) {
    return { rv: first, ...firstOutcome, rerolled: false, first, usedRolls: 1 };
  }
  const second = Number(values[1]) || 0;
  return { rv: second, ...testOutcome(second, threshold), rerolled: true, first, usedRolls: 2 };
}

/**
 * Последствия исхода: какой текст писать и что сделать с Хозяином.
 * @param {string}  reasonKey  ключ LOYALTY_REASONS
 * @param {boolean} success
 * @param {object}  [o]
 * @param {boolean} [o.inCombat]  тест идёт в бою (Миньон в активном бою)
 * @returns {{text:string, gmControl:boolean, restoreMasterInfamy:number}}
 */
export function loyaltyConsequence(reasonKey, success, { inCombat = false } = {}) {
  const def = LOYALTY_REASONS[reasonKey] ?? LOYALTY_REASONS.other;
  if (def.adoringCrowds) {
    return success
      ? { text: "Миньон в восторге от Хозяина: тот восстанавливает 1 Очко Бесчестия.", gmControl: false, restoreMasterInfamy: 1 }
      : { text: def.failText, gmControl: false, restoreMasterInfamy: 0 };
  }
  if (success) return { text: LOYALTY_SUCCESS_TEXT, gmControl: false, restoreMasterInfamy: 0 };
  const gmControl = !!(inCombat && def.combatFailControl);
  return { text: def.failText, gmControl, restoreMasterInfamy: 0 };
}

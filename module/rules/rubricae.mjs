// module/rules/rubricae.mjs
// ════════════════════════════════════════════════════════════════════════
//  Черта Rubricae / Рубрикант (Голем Рубрики, Колдун Рубрики — корбук,
//  III. Продвижение). Книга: «Не может говорить, совершать Бег и не получает
//  Порчу. Когда его Раны опускаются ниже 0, он рассыпается грудой пустых
//  доспехов.»
//
//  Три возможности — записи Конструктора kind:"capability" на Черте (и на её
//  копии в профиле Бестиария «Голем Рубрики»); каждую читает своё место:
//    • corruption.immune        — прирост Порчи отменяется (preUpdateActor
//                                 в warhammer-dbc.mjs, тот же перехват, что
//                                 у Пустоты Парии);
//    • movement.noRun           — Бег не объявляется (combat/movement-actions.mjs
//                                 ::declareRun);
//    • death.crumbleBelowZero   — Раны ниже 0: вместо Критических Эффектов
//                                 метка «погиб» (combat/damage.mjs, та же ветка,
//                                 что у Роя).
//  «Не может говорить» — механики речи в системе нет, остаётся текстом Черты.
//
//  Чистые функции, файл ничего не импортирует (источник правил не нужен —
//  возможности читаются через hasRuleFlag в местах вызова).
// ════════════════════════════════════════════════════════════════════════

export const CORRUPTION_IMMUNE_CAP = "corruption.immune";
export const NO_RUN_CAP = "movement.noRun";
export const CRUMBLE_CAP = "death.crumbleBelowZero";
/** Имя Черты — запасное опознание для копий, выданных до записей Конструктора
 *  (ключа на них нет до «Обновить мир», приёмка #597): hasAbility(actor, CAP, RUBRICAE, "trait"). */
export const RUBRICAE = "Rubricae";

/**
 * Значение Порчи, которое оставить при иммунитете: прирост отменяется,
 * снижение проходит как есть.
 */
export function corruptionWithImmunity(oldValue, newValue) {
  const o = Number(oldValue) || 0, n = Number(newValue) || 0;
  return n > o ? o : n;
}

/**
 * Рассыпается ли носитель после урона: Раны ушли ниже 0 (в системе это
 * переполнение в Критические — gotCritical из applyWoundLoss).
 */
export function crumblesOnWoundLoss(hasCrumble, gotCritical) {
  return !!hasCrumble && !!gotCritical;
}

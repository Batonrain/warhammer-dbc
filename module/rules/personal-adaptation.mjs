// module/rules/personal-adaptation.mjs
// ════════════════════════════════════════════════════════════════════════
//  Personal Adaptation / Персональная Адаптация (Тзинч, wdbc-1rno, d100
//  78…80): «После каждого встречного теста он получает бонус +5 на все
//  остальные встречные тесты против того же персонажа до максимума в
//  +(½Cor.b (окр.▲))×5. Этот бонус сохраняется на до 9 лет на каждого
//  персонажа.»
//
//  «После КАЖДОГО» — книга не говорит «после победы»: запись растёт
//  независимо от исхода (см. вызывающую сторону в kind-outcome.mjs/
//  actor-sheet.mjs — обе зовут recordPersonalAdaptation() безусловно).
//
//  Список ситуативных модификаторов диалога Навыка/Характеристики
//  (sheets/actor-sheet.mjs::_showSkillRollDialog) считается ОДИН раз при
//  открытии — ДО того, как игрок выбирает вид теста «Встречный» в самом
//  диалоге (readTestKind читает выбор только в колбэке кнопки «Бросок»).
//  Поэтому бонус нельзя показать галочкой в общем списке модификаторов —
//  вместо этого он прибавляется к Порогу ПРЯМО В МОМЕНТ разрешения
//  встречного сравнения (module/rules/kind-outcome.mjs — сторона-
//  инициатор при авто-NPC-сопернике; module/sheets/actor-sheet.mjs::
//  _maybePostOpposedComparison — сторона-ответчик при живом инициаторе),
//  со своей строкой в карточке результата — тот же уровень прозрачности,
//  просто после броска, а не до.
//
//  Протухание — ленивое, по чтению (personalAdaptationBonusFor сверяет
//  expiresAt с текущим worldTime сама), без активного тика на устаревание:
//  в отличие от Пожирателя Знаний, здесь нечего откатывать на СТОРОНЕ
//  третьих лиц (бонус — целиком собственное состояние чемпиона), протухшая
//  запись просто перестаёт давать число и переписывается с нуля при
//  следующем встречном тесте против того же персонажа.
// ════════════════════════════════════════════════════════════════════════

export const PERSONAL_ADAPTATION_CAPABILITY = "gift.tzeentch.personalAdaptation";

/** Флаг на чемпионе — список { targetUuid, bonus, expiresAt }. */
export const PERSONAL_ADAPTATION_FLAG = "personalAdaptationBonuses";

/** Секунд в 9 игровых годах (365-дневный год — тот же счёт, что уже даёт «Календарь»). */
export const NINE_YEARS = 9 * 365 * 86400;

/** Потолок бонуса по текущему Cor.b: +(⌈Cor.b/2⌉)×5. */
export function personalAdaptationCap(corruptionBonus) {
  const cb = Math.max(0, Number(corruptionBonus) || 0);
  return Math.ceil(cb / 2) * 5;
}

/** Текущий (ещё не протухший) бонус против конкретной цели — 0, если записи нет/истекла. */
export function personalAdaptationBonusFor(list, targetUuid, worldTime) {
  const rec = (Array.isArray(list) ? list : []).find(r => r?.targetUuid === targetUuid);
  if (!rec) return 0;
  if (Number(worldTime) >= Number(rec.expiresAt)) return 0;
  return Number(rec.bonus) || 0;
}

/**
 * Список после «ещё одного встречного теста» против targetUuid — растит на
 * +5 существующую ЖИВУЮ запись (капируя), протухшую или отсутствующую
 * заводит заново с +5; срок жизни всегда переставляется на 9 лет вперёд от
 * ТЕКУЩЕГО worldTime (не продлевается от старого expiresAt).
 */
export function nextPersonalAdaptationBonuses(list, targetUuid, worldTime, cap) {
  const arr = Array.isArray(list) ? list : [];
  const alive = arr.filter(r => r?.targetUuid !== targetUuid);
  const prevBonus = personalAdaptationBonusFor(arr, targetUuid, worldTime);
  const bonus = Math.min(Math.max(0, Number(cap) || 0), prevBonus + 5);
  return [...alive, { targetUuid, bonus, expiresAt: Number(worldTime) + NINE_YEARS }];
}

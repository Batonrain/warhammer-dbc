// module/combat/warp-touched.mjs
// ════════════════════════════════════════════════════════════════════════
//  Затронутый Варпом, субмутация 10 «Недоверие к Лечению» (wdbc-1rno.26) —
//  постановка метки «лечили не вы сами». Чистая часть и сам штраф —
//  rules/warp-touched.mjs (источник реестра «warpTouchedHealMistrust»).
//
//  Метку ставят места, где система знает И пациента, И того, кто лечит:
//   • окно Лечения (sheets/tabs/healing.mjs::applyHealing) — Раны
//     восстановлены, лечащий ≠ пациент;
//   • препарат, вколотый другим (sheets/tabs/drugs.mjs::applyDrug,
//     applyToOther) — и он вылечил Раны;
//   • период лечения по Календарю под успешным Мед. уходом медика
//     (combat/healing-clock.mjs) — Раны восстановлены, пока уход действовал.
//  Повторное лечение в течение часа продлевает срок от нового момента.
// ════════════════════════════════════════════════════════════════════════

import { hasRuleFlag } from "../rules/flags.mjs";
import { HEAL_MISTRUST_CAPABILITY, HEAL_MISTRUST_FLAG, healMistrustUntil, isHealedByOther }
  from "../rules/warp-touched.mjs";

/**
 * Пациента вылечил healer: если у пациента «Недоверие к Лечению» и лечил не
 * он сам — штраф на час. Возвращает строку для карточки лечения ("" — ничего).
 * `at` — момент лечения, если он был раньше «сейчас» (прыжок Календаря на
 * несколько периодов): час отсчитывается от него, истёкший — не ставится.
 */
export async function noteHealingFromOther(patient, healer, { at = null } = {}) {
  if (!isHealedByOther(healer, patient) || !hasRuleFlag(patient, HEAL_MISTRUST_CAPABILITY)) return "";
  const now = Number(globalThis.game?.time?.worldTime) || 0;
  const until = healMistrustUntil(at ?? now);
  if (until <= now) return "";
  await patient.setFlag("warhammer-dbc", HEAL_MISTRUST_FLAG, until);
  return "🩹 Недоверие к Лечению (Затронутый Варпом): −10 на все тесты, кроме T, на 1 час.";
}

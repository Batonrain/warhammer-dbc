// module/combat/head-guard.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Head Guard / Прикрытие Головы (Талант Стойкости, глава 3): «Раз в Раунд, когда
//  он получает попадание в голову (но не Избирательный в глаз или сочленения
//  шеи), персонаж может перенести это попадание на одну из своих рук по своему
//  выбору.»
//
//  Вызывается из конвейера урона (combat/damage.mjs::applyDamageToActor) ДО
//  расчёта поглощения: от места попадания зависят и AP брони, и таблица
//  Критического Эффекта, и укрытие — поэтому место подменяется целиком, одной
//  точкой, как редиректы Безголового и Бронзового Мирмидона рядом.
//
//  «Раз в Раунд» — примитив apps/game-session.mjs. Без идущего боя Раунда нет:
//  примитив тогда всегда «доступно» и отметку не пишет, так что вне боя диалог
//  предлагается на каждое попадание в голову (лимит считать не от чего).
// ════════════════════════════════════════════════════════════════════════════

import { esc } from "../helpers/utils.mjs";
import { hasResilienceTalent, headGuardApplies, HEAD_GUARD_ARMS } from "../rules/resilience-talents.mjs";
import { isRoundCapabilityAvailable, markRoundCapabilityUsed } from "../apps/game-session.mjs";

/** Имя метки «раз в Раунд» на акторе (usageLimits.<имя с дефисами>). */
export const HEAD_GUARD_ROUND = "resilience.headGuard";

/**
 * Предложить перенос попадания в голову на руку.
 * @returns {Promise<{hitLocation:string, note:string}>} новое место попадания и строка
 *   для карточки урона ("" — не переносили)
 */
export async function headGuardOffer(actor, hitLocation) {
  const same = { hitLocation, note: "" };
  if (!actor || !headGuardApplies(hitLocation) || !hasResilienceTalent(actor, "headGuard")) return same;
  if (!isRoundCapabilityAvailable(actor, HEAD_GUARD_ROUND)) return same;

  const choice = await foundry.applications.api.DialogV2.wait({
    window: { title: "Прикрытие Головы" },
    content: `<p>${esc(actor.name)} получает попадание в голову. Раз в Раунд можно подставить под него руку — перенести попадание?</p>`,
    rejectClose: false,
    buttons: [
      { action: "rightArm", label: "В правую руку" },
      { action: "leftArm", label: "В левую руку" },
      { action: "no", label: "Не переносить" }
    ]
  }).catch(() => null);

  const target = HEAD_GUARD_ARMS[choice];
  if (!target) return same;
  await markRoundCapabilityUsed(actor, HEAD_GUARD_ROUND);
  return { hitLocation: target, note: `🛡 Прикрытие Головы: попадание в голову перенесено — место «${target}» (раз в Раунд).` };
}

// module/combat/avatar-of-slaughter.mjs
// ════════════════════════════════════════════════════════════════════════
//  Avatar of Slaughter/Аватар Резни (Черта, Берсерк Кхорна, wdbc-sk8s):
//  «Раз за бой в конце своего Хода может потратить Очко Бесчестия, чтобы
//  направить кровожадность в одного противника в пределах видимости. Тест
//  W−10, иначе до конца боя −20 на все атаки и манёвры, направленные не на
//  Берсерка.»
//
//  «В пределах видимости» — ручной выбор цели (game.user.targets), тем же
//  приёмом, что и весь остальной проект (LOS нигде не автоматизирован).
//  «В конце своего Хода» — кнопка доступна всегда, момент нажатия не
//  проверяется (тот же уровень доверия столу, что у остальных ручных
//  триггеров этой сессии).
//
//  Тест W−10 — ЦЕЛИ, не Берсерка («иначе» относится к её провалу). Провал →
//  метка flags.warhammer-dbc.avatarOfSlaughterMark={berserkerUuid} до конца
//  боя, следствие — module/rules/library/avatar-of-slaughter.mjs (−20 на
//  атаки не по Берсерку, через общий реестр правил).
// ════════════════════════════════════════════════════════════════════════

import { itemHasName } from "../rules/predicates.mjs";
import { isCapabilityAvailable, markCapabilityUsed } from "../rules/cooldown.mjs";
import { testOutcome } from "../rules/roll-outcome.mjs";
import { esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";

const FLAG = "avatarOfSlaughter";

/** Владеет ли актор Чертой Avatar of Slaughter / Аватар Резни. */
export function hasAvatarOfSlaughter(actor) {
  return !!actor?.items?.some(i => i.type === "trait" && itemHasName(i, "Avatar of Slaughter"));
}

/** Доступно ли прямо сейчас — Черта + не использовано в этом бою. */
export function avatarOfSlaughterAvailable(actor) {
  return hasAvatarOfSlaughter(actor) && isCapabilityAvailable(actor, FLAG, "battle");
}

/**
 * Применяет способность: тратит 1 Очко Бесчестия Берсерка, цель проходит
 * W−10 — при провале получает метку (читает rules/library/
 * avatar-of-slaughter.mjs через общий реестр правил).
 */
export async function applyAvatarOfSlaughter(berserker, target) {
  if (!target) return;
  await markCapabilityUsed(berserker, FLAG, "battle");
  const fate = berserker.system.fate?.value ?? 0;
  if (fate > 0) await berserker.update({ "system.fate.value": fate - 1 });

  const threshold = (Number(target.system?.characteristics?.wp?.total) || 0) - 10;
  const roll = await new Roll("1d100").evaluate();
  const { success } = testOutcome(roll.total, threshold);

  if (!success) {
    await target.setFlag("warhammer-dbc", "avatarOfSlaughterMark", { berserkerUuid: berserker.uuid });
  }

  await ChatMessage.create(ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor: berserker }),
    content: `<div class="wh-roll-result">
      <div class="roll-header">${rollIcon("skull", "#ff6b6b")}Аватар Резни — ${esc(berserker.name)}</div>
      <div class="roll-threshold">Цель: <b>${esc(target.name)}</b> — Воля−10: <b>${threshold}</b></div>
      <div class="roll-dice">Бросок: <b>${roll.total}</b></div>
      <div class="roll-outcome">${success
        ? `<span class="roll-success">Устояла — эффекта нет</span>`
        : `<span class="roll-failure">Провал — до конца боя −20 на атаки/манёвры не по Берсерку</span>`}</div>
    </div>`
  }, game.settings.get("core", "rollMode")));
}

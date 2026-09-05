// module/combat/assassin-strike.mjs
// ════════════════════════════════════════════════════════════════════════
//  Assassin Strike / Удар Ассасина (wdbc-qpcg, packs-src/talents/Рукопашные/
//  Assassin_Strike___Удар_Ассасина_…json): «Раз в Раунд после рукопашной
//  атаки (успешной или нет) персонаж может пройти Acrobatics+0 и совершить
//  Полудвижение как свободное действие, не вызывая свободные атаки, если
//  покидает им рукопашную».
//
//  Кнопка — на карточке атаки (attack-card.mjs), показывается при
//  isMelee=true и владении Талантом, throttle "round" (тот же приём —
//  isRoundCapabilityAvailable/markRoundCapabilityUsed, — что уже использует
//  Свободная Атака, module/combat/free-attack.mjs). Независимо от исхода
//  самой атаки — гейт по hit/miss не добавляется намеренно (правило прямо
//  говорит «успешной или нет»).
//
//  При успехе теста: Полудвижение как свободное действие (markMovedThisTurn
//  БЕЗ spendActionPoints — ОД не тратятся) + flags.warhammer-dbc.
//  disengageActive = true, тот же разовый флаг, что ставит «Выход из Боя»
//  (module/combat/movement-actions.mjs::declareDisengage) — гасит первую же
//  Свободную Атаку по этому токену (module/combat/free-attack.mjs::
//  processTokenMove), если Полудвижением персонаж покидает рукопашную.
//
//  НЕ подключено здесь: удвоение «длины» Таланта Малеарием
//  (module/combat/recoil-item-bonuses.mjs::malaeriusActive, из PR #319,
//  ещё не в main на момент этого тикета) — у Полудвижения нет отдельной
//  «длины» помимо actor.system.movement.halfMove, удвоение уже покрывается
//  общей формулой SPD, отдельный консьюмер не нужен.
// ════════════════════════════════════════════════════════════════════════

import { itemHasName } from "../rules/predicates.mjs";
import { isRoundCapabilityAvailable, markRoundCapabilityUsed } from "../apps/game-session.mjs";
import { skillTotal, markMovedThisTurn } from "./movement-actions.mjs";
import { degreesOfSuccess } from "../constants/craft.mjs";
import { esc, _degWord } from "../helpers/utils.mjs";
import { collectTestMods } from "../rules/roll-mods.mjs";
import { postTestCard, thresholdLine } from "../helpers/test-card.mjs";

/** Ключ флага троттлинга «раз в Раунд» (module/rules/cooldown.mjs). */
export const ASSASSIN_STRIKE_CAPABILITY = "assassinStrike";

/** Владеет ли актор Талантом Assassin Strike / Удар Ассасина. */
export function hasAssassinStrike(actor) {
  return !!actor?.items?.some(i => i.type === "talent" && itemHasName(i, "Assassin Strike"));
}

/** Показывать ли кнопку на карточке: Талант есть И раунд ещё не потрачен. */
export function assassinStrikeAvailable(actor) {
  return hasAssassinStrike(actor) && isRoundCapabilityAvailable(actor, ASSASSIN_STRIKE_CAPABILITY);
}

/**
 * Клик по кнопке в чате — тест Acrobatics+0, при успехе даёт свободное
 * Полудвижение (без ОД) и ставит disengageActive.
 */
export async function resolveAssassinStrikeClick(actorUuid) {
  const actor = await fromUuid(actorUuid).catch(() => null);
  if (!actor) return ui.notifications.warn("⚠️ Актор не найден.");
  if (!actor.isOwner) return ui.notifications.warn("⚠️ Нет прав на этого актора.");
  if (!isRoundCapabilityAvailable(actor, ASSASSIN_STRIKE_CAPABILITY)) {
    return ui.notifications.warn(`⚠️ ${actor.name}: Удар Ассасина уже потрачен в этом Раунде.`);
  }
  await markRoundCapabilityUsed(actor, ASSASSIN_STRIKE_CAPABILITY);

  // Общий сбор модификаторов (wdbc-ct65.3): тест Акробатики шёл мимо реестра
  // правил — ни Усталость, ни «+10 к Акробатике» с Черты в него не попадали.
  const ruleMods = collectTestMods(actor, { kind: "skill", skill: "acrobatics", char: "ag" });
  const threshold = skillTotal(actor, "acrobatics") + ruleMods.total;
  const roll = await new Roll("1d100").evaluate();
  const rv = roll.total;
  const success = rv <= threshold;
  const dof = Math.abs(degreesOfSuccess(rv, threshold));

  if (success) {
    await markMovedThisTurn(actor);
    await actor.setFlag("warhammer-dbc", "disengageActive", true);
  }

  await postTestCard(actor, {
    icon: "🗡️", title: `Удар Ассасина — ${esc(actor.name)}`,
    threshold: thresholdLine({ label: "Acrobatics+0", base: skillTotal(actor, "acrobatics"),
                               parts: ruleMods.parts, threshold }),
    rv,
    outcome: success
      ? `<span class="roll-success">Успех — Полудвижение свободным действием (без ОД), не вызывает Свободную Атаку при выходе из рукопашной</span>`
      : `<span class="roll-failure">Провал — ${dof} ${_degWord(dof)}, Полудвижение недоступно</span>`
  }, { rolls: [roll] });
  return success;
}

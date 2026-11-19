// module/combat/defence-reroll.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Переброс проваленной защиты с её карточки — Foundry-сторона
//  rules/defence-reroll.mjs (что предлагать — там).
//
//    onDefenceRerollClick(message, ruleId) — кнопка «Перебросить Уклонение:
//      <Талант>»: проверить, что переброс всё ещё доступен, отметить его
//      потраченным (ограничитель «раз в Раунд») и повторить тот же тест;
//    rerollDefenceCard(message, label, pay) — тот же повтор для «Переброса за Очко»
//      из меню карточки (hooks.mjs): раньше он перебрасывал голый d100 и не
//      пересчитывал, сколько попаданий снято.
//
//  Повтор — тот же _performDodge/_performParry с параметрами исходного вызова
//  из флага карточки: Реакция второй раз не тратится, окна до броска не
//  открываются (их ответы едут в carry).
// ════════════════════════════════════════════════════════════════════════════

import { _performDodge, _performParry } from "./defense.mjs";
import { DEFENCE_TEST_FLAG, DEFENCE_REROLLED_FLAG, defenceRerollsFor, defenceRerollWindowOpen } from "../rules/defence-reroll.mjs";
import { commitRerollUse } from "./angel-hunters.mjs";
import { runCardOnce } from "./card-once.mjs";
import { reverseD100 } from "../rules/reroll-pick.mjs";

const NS = "warhammer-dbc";

/** Параметры защиты, записанные на карточке (null — карточка не защиты). */
export function defenceTestOf(message) {
  return message?.flags?.[NS]?.[DEFENCE_TEST_FLAG] ?? null;
}

async function actorOf(test) {
  const doc = test?.actorUuid ? await fromUuid(test.actorUuid).catch(() => null) : null;
  return doc?.actor ?? doc ?? null;
}

/** Повторить защиту с карточки как переброс. */
async function performDefenceReroll(actor, test, label, forcedRv = null) {
  const run = test.kind === "parry" ? _performParry : _performDodge;
  await run(actor, { ...(test.opts ?? {}), reroll: { label, ...(forcedRv ? { forcedRv } : {}) }, carry: test.carry ?? null });
  return true;
}

/** Результат d100 исходной защиты — первый бросок карточки. */
function cardRollValue(message) {
  const v = Number(message?.rolls?.[0]?.total);
  return Number.isFinite(v) ? v : null;
}

const WINDOW_CLOSED = "⚠️ Эта защита была в другом Раунде или бою — перебросить её уже нельзя.";

/** Кнопка переброса Черты/Таланта на карточке проваленной защиты. */
export async function onDefenceRerollClick(message, ruleId) {
  const test = defenceTestOf(message);
  if (!test || test.passed || test.rerolled) return ui.notifications?.warn("⚠️ Эту защиту перебросить нельзя.");
  const actor = await actorOf(test);
  if (!actor) return ui.notifications?.warn("⚠️ Защищавшийся персонаж не найден.");
  if (!game.user?.isGM && !actor.isOwner) return ui.notifications?.warn(`⚠️ Нет прав на «${actor.name}».`);
  if (!defenceRerollWindowOpen(test, game.combat)) return ui.notifications?.warn(WINDOW_CLOSED);
  const attackerUuid = test.opts?.attackerUuid;
  const attackerDoc = attackerUuid ? await fromUuid(attackerUuid).catch(() => null) : null;
  const offer = defenceRerollsFor(actor, test.kind, {
    attackerActor: attackerDoc?.actor ?? attackerDoc, isMelee: test.opts?.isMelee ?? true
  }).find(r => r.ruleId === ruleId);
  if (!offer) return ui.notifications?.warn("⚠️ Этот переброс сейчас недоступен (уже потрачен в этом Раунде?).");
  // «Обратить бросок» (десятки ↔ единицы): тот же кубик, а не новый. Обращать
  // имеет смысл, только если обращённое число меньше.
  let forcedRv = null;
  if (offer.mode === "reverse") {
    const rv = cardRollValue(message);
    const alt = rv == null ? null : reverseD100(rv);
    if (alt == null || alt >= rv) return ui.notifications?.warn("⚠️ Обращение этого броска ничего не даёт.");
    forcedRv = alt;
  }
  return runCardOnce(message, DEFENCE_REROLLED_FLAG, async () => {
    if (offer.limit) await commitRerollUse(actor, { limit: offer.limit, sourceUuid: offer.source?.uuid ?? "" });
    return performDefenceReroll(actor, test, offer.mode === "reverse" ? `${offer.label} (обращение)` : offer.label, forcedRv);
  }, "Эту защиту уже перебросили.");
}

/**
 * «Переброс за Очко» из меню карточки защиты. Те же условия, что у кнопки
 * Таланта: только проваленная, ещё не переброшенная защита своего Раунда, раз
 * на карточку (общая отметка DEFENCE_REROLLED_FLAG). Успешную защиту не
 * повторяют: второй бросок силового поля и снятие попаданий легли бы дважды.
 * Очко списывает `pay` — только когда переброс точно состоится.
 * @param {() => Promise<any>} pay списать Очко; ложь — не хватило, повтора нет
 * @returns {Promise<boolean>} false — карточка не защиты или актор не найден (вызывающий перебросит по-старому);
 *   true — разобрано здесь (переброшено или отказано с уведомлением)
 */
export async function rerollDefenceCard(message, label, pay = async () => true) {
  const test = defenceTestOf(message);
  if (!test) return false;
  const actor = await actorOf(test);
  if (!actor) return false;
  if (test.passed || test.rerolled) ui.notifications?.warn("⚠️ Перебросить можно только проваленную и ещё не переброшенную защиту.");
  else if (!defenceRerollWindowOpen(test, game.combat)) ui.notifications?.warn(WINDOW_CLOSED);
  else await runCardOnce(message, DEFENCE_REROLLED_FLAG,
    async () => !!(await pay()) && performDefenceReroll(actor, test, label), "Эту защиту уже перебросили.");
  return true;
}

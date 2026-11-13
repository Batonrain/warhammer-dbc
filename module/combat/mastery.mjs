// module/combat/mastery.mjs
// ════════════════════════════════════════════════════════════════════════
//  Мастерство, автоуспех за Очко Бесчестия (стр. 62) — Foundry-обвязка к
//  module/rules/mastery.mjs. [книга] «Он может потратить Очко Бесчестия для
//  того, чтобы автоматически пройти тест на выбранный Навык с окончательным
//  модификатором +0 или легче с количеством Успехов, равным бонусу
//  использованной в тесте Характеристики».
//
//  Пункт меню Очков на карточке теста (hooks.mjs::_attachFateContextMenu) —
//  тот же приём, что у Хирургии Легиона: бросок не переигрывается, меняется
//  исход. Раз на карточку (флаг masteryAutoSuccessUsed, combat/card-once.mjs).
//
//  [допущение] Решение принимается по факту броска, как у остальных трат Очка
//  на карточке, хотя книга говорит «вместо теста»: игрок видит, что выпало,
//  прежде чем платить. Предлагается только тогда, когда автоуспех даёт не
//  меньше Успехов, чем уже вышло.
// ════════════════════════════════════════════════════════════════════════

import { esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { postTestCard } from "../helpers/test-card.mjs";
import { actorInfamyPath, actorInfamyValue, spendFromInfamyPool } from "../apps/infamy-points.mjs";
import { tempInfamyAmount } from "../rules/temp-infamy.mjs";
import { masteryAutoSuccessOffer } from "../rules/mastery.mjs";
import { runCardOnce } from "./card-once.mjs";
import { revertCardFailure, failUndoLineHtml } from "./fear.mjs";
import { _degWord } from "../helpers/utils.mjs";

/** Есть ли чем платить: обычный пул или временный запас. */
export function masteryHasPoint(actor) {
  return actorInfamyValue(actor) + tempInfamyAmount(actor) >= 1;
}

async function spendOne(actor) {
  const path = actorInfamyPath(actor);
  const spend = await spendFromInfamyPool(actor, 1, path);
  if (!spend) return false;
  await actor.update({ [path]: spend.poolValue });
  return true;
}

/**
 * Автоуспех на карточке теста. true — Очко потрачено, тест засчитан.
 * @param {Actor} actor
 * @param {object} skillTest флаг skillTest карточки
 * @param {ChatMessage} message
 */
export async function masteryAutoSuccessOnCard(actor, skillTest, message) {
  const offer = masteryAutoSuccessOffer(actor, skillTest);
  if (!offer) {
    ui.notifications?.warn("Мастерство здесь не применимо: нет Таланта на этот Навык или поправки хуже +0.");
    return false;
  }
  return runCardOnce(message, "masteryAutoSuccessUsed", async () => {
    if (!masteryHasPoint(actor)) { ui.notifications?.warn(`${actor.name}: нет Очков Бесчестия.`); return false; }
    if (!(await spendOne(actor))) return false;
    // Автоуспех на проваленном тесте — наложенный им Шок/Ступор снимается (task-e30b).
    const reverted = await revertCardFailure(message);
    await postTestCard(actor, {
      icon: rollIcon("spark", "#4dffa6"),
      title: `Мастерство — ${esc(actor.name)}`,
      lines: [`<div class="roll-threshold">Тест «${esc(skillTest.label || "Навык")}» проходит автоматически (поправки не хуже +0). Осталось Очков: <b>${actorInfamyValue(actor) + tempInfamyAmount(actor)}</b>.</div>`, failUndoLineHtml(reverted)],
      outcome: `<span class="roll-success">Успех — ${offer.deg} ${_degWord(offer.deg)} (Бонус Характеристики; потрачено Очко Бесчестия)</span>`
    }, { sound: false, speaker: message.speaker });
    return true;
  }, "Здесь Мастерство уже применено.");
}

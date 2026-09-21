// module/combat/rapid-reaction.mjs
//
// Rapid Reaction / Быстрая Реакция (wdbc-1rno.3): реактивный тест A+0 в
// начале Хода Застигнутого Врасплох (стр. 12) — успех отменяет 0 ОД/0
// Реакций этого Хода. Тот же приём, что «Выход из Шока» (combat/fear.mjs::
// postShockRecoveryPrompt/rollShockRecovery) — карточка с кнопкой, тест не
// автоматический.
//
// wasSurprised передаётся снимком ИЗВНЕ (hooks.mjs, снят ДО вызова
// resetActionEconomy): тот сам гасит conditions.surprised как часть
// «единственный Ход, который они пропускают» (action-economy.mjs), поэтому
// к моменту показа этой подсказки флага на акторе уже нет — проверять
// текущее значение здесь нечего.
//
// Успех пересчитывает ОД/Реакции ПОВТОРНЫМ вызовом resetActionEconomy —
// safe: surprised к этому моменту уже false (снят первым вызовом), значит
// apLocked считается заново только по Оглушению/Без сознания (если они
// тоже есть — тест Быстрой Реакции их не снимает, RAW этого и не обещает).
// Побочные флаги turnStartFlagClears/turnStartAttackCarryOver идемпотентны
// при повторном вызове в тот же такт (rules/turn-flags.mjs — гасят/
// переносят по факту наличия, второй проход в тот же Ход ничего не находит).

import { postTestCard, rollStatLine } from "../helpers/test-card.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { esc } from "../helpers/utils.mjs";
import { hasRapidReaction } from "../rules/rapid-reaction.mjs";
import { resetActionEconomy } from "./action-economy.mjs";

/** Нужна ли подсказка «Быстрая Реакция» в начале этого Хода. */
export function shouldOfferRapidReaction(actor, wasSurprised) {
  return !!wasSurprised && hasRapidReaction(actor);
}

/** Карточка-приглашение — тест катается по кнопке, не автоматически. */
export async function postRapidReactionPrompt(actor) {
  const rollMode = game.settings.get("core", "rollMode");
  const messageData = ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `
      <div class="wh-roll-result">
        <div class="roll-header">${rollIcon("run", "#4dffa6")}${esc(actor.name)} застигнут Врасплох — Быстрая Реакция</div>
        <div class="roll-threshold">Тест A+0, чтобы действовать обычным образом (иначе 0 ОД и 0 Реакций этот Ход).</div>
        <div class="roll-defense-btns">
          <button class="wh-rapid-reaction-btn" type="button" data-actor-uuid="${actor.uuid}">Тест</button>
        </div>
      </div>`,
    sound: null
  }, rollMode);
  await ChatMessage.create(messageData);
}

/** Тест A+0 — успех восстанавливает ОД/Реакции обычного Хода. */
export async function rollRapidReactionTest(actor) {
  const ag = Number(actor.system?.characteristics?.ag?.total) || 0;
  const roll = await new Roll("1d100").evaluate();
  const rv = roll.total;
  const success = rv <= ag;

  if (success) await resetActionEconomy(actor);

  await postTestCard(actor, {
    icon: rollIcon("run", "#4dffa6"), title: `Быстрая Реакция — ${esc(actor.name)}`,
    threshold: rollStatLine({ label: "Ag", base: ag, parts: [], threshold: ag, rv }),
    outcome: success
      ? `<span class="roll-success">Успех — действует обычным образом, ОД/Реакции этого Хода восстановлены.</span>`
      : `<span class="roll-failure">Провал — Врасплох как обычно: 0 ОД и 0 Реакций этот Ход.</span>`
  }, { rolls: [roll] });

  return { success };
}

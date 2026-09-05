// module/combat/pacifism.mjs
// ════════════════════════════════════════════════════════════════════════
//  «Крайне миролюбив» (Серый Человек, wdbc-gzuf): не входит в Ярость, пока
//  не атакован в этом бою — иначе тест Воли−20 или явный отказ.
//
//  Флаг «атакован» (PACIFISM_ATTACKED_FLAG) выставляет
//  module/combat/damage.mjs::applyDamageToActor, сбрасывает Hooks.on(
//  "combatStart") в warhammer-dbc.mjs. Сама галочка system.inRage
//  перехватывается парой preUpdateActor/updateActor там же (снимает попытку,
//  зовёт postPacifismGateCard) — здесь только бросок теста и карточки чата.
// ════════════════════════════════════════════════════════════════════════

import { degreesOfSuccess } from "../constants/craft.mjs";
import { esc, _degWord } from "../helpers/utils.mjs";
import { collectTestMods } from "../rules/roll-mods.mjs";
import { postTestCard, thresholdLine } from "../helpers/test-card.mjs";

export const PACIFISM_ATTACKED_FLAG = "grayManAttacked";
export const PACIFISM_CAPABILITY = "pacifism.requiresAttackToRage";

/** Карточка с выбором при попытке войти в Ярость до первой атаки по себе. */
export async function postPacifismGateCard(actor) {
  const messageData = ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `
      <div class="wh-roll-result">
        <div class="roll-header">🕊️ Крайне миролюбив — ${esc(actor.name)}</div>
        <div class="roll-threshold">Не атакован в этом бою — войти в Ярость нельзя без теста Воли−20, или отказаться явно.</div>
        <div class="roll-defense-section wh-owner-only" data-actor-id="${actor.id}">
          <div class="roll-defense-btns">
            <button type="button" class="wh-pacifism-test-btn">🎲 Тест Воли−20</button>
            <button type="button" class="wh-pacifism-refuse-btn">Отказаться от Ярости</button>
          </div>
        </div>
      </div>`,
    sound: null
  }, game.settings.get("core", "rollMode"));
  messageData.flags = foundry.utils.mergeObject(messageData.flags || {}, {
    "warhammer-dbc": { pacifismGate: { actorId: actor.id } }
  });
  await ChatMessage.create(messageData);
}

/** Тест Воли−20 — успех проводит актора в Ярость вопреки миролюбию. */
export async function rollPacifismTest(actor) {
  const wp = actor.system.characteristics?.wp?.total ?? 0;
  // Общий сбор модификаторов (wdbc-ct65.3): тест Воли шёл мимо реестра правил.
  const ruleMods = collectTestMods(actor, { kind: "skill", char: "wp" });
  const threshold = wp - 20 + ruleMods.total;
  const roll = await new Roll("1d100").evaluate();
  const rv = roll.total;
  const success = rv <= threshold;
  const dof = Math.abs(degreesOfSuccess(rv, threshold));

  if (success) await actor.update({ "system.inRage": true }, { whSkipPacifismGate: true });

  await postTestCard(actor, {
    icon: "🕊️", title: `Тест Воли−20 — ${esc(actor.name)}`,
    threshold: thresholdLine({ label: "W", base: wp, parts: ["миролюбие −20", ...ruleMods.parts], threshold }),
    rv,
    outcome: success
      ? `<span class="roll-success">Успех — Ярость входит вопреки миролюбию</span>`
      : `<span class="roll-failure">Провал — ${dof} ${_degWord(dof)}, в Ярость войти не удаётся</span>`
  }, { rolls: [roll] });
  return success;
}

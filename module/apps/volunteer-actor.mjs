// module/apps/volunteer-actor.mjs
// ════════════════════════════════════════════════════════════════════════
//  Volunteer Actor/Доброволец Актёр (wdbc-ux8a) — слой Foundry-действий:
//  захват (Поцелуй Мимика), обрыв нити (смерть — реюз deathButtonHtml),
//  хирургическое извлечение (16ч worldTime-таймер + тест Medicae(I)−40,
//  подтверждаемый вручную — та же честная граница, что у остального
//  тикета: система не гонит бросок Навыка сама за игрока).
// ════════════════════════════════════════════════════════════════════════

import { esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { deathButtonHtml } from "../combat/crit-effect-parser.mjs";
import { conditionApplyFields, conditionRemoveFields } from "../sheets/tabs/conditions.mjs";
import { establishControl, releaseControl, controllerUuidOf } from "../rules/actor-control.mjs";
import { scheduleMimicWireSurgery, isMimicWireSurgeryReady, MIMIC_WIRE_SURGERY_FLAG } from "../rules/volunteer-actor.mjs";
import { requestControlOwnership, requestRevokeControlOwnership } from "./actor-control.mjs";

const SCOPE = "warhammer-dbc";

async function _card(actor, title, bodyHtml) {
  await ChatMessage.create(ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="wh-roll-result">
      <div class="roll-header">${rollIcon("spark","#c9a0ff")}${esc(title)} — ${esc(actor.name)}</div>
      ${bodyHtml}
    </div>`
  }, game.settings.get("core", "rollMode")));
}

/**
 * Поцелуй Мимика: цель → 1 Рана, накладывается mimicWire (+ опционально
 * блок психосил/техночудес), устанавливается контроль. Реальная передача
 * Foundry-владения — лучшая попытка, best-effort (не блокирует захват при
 * отказе, module/apps/actor-control.mjs сам предупреждает при неудаче).
 */
export async function captureWithMimicWire(attackerActor, targetActor, { blockPowers = false, sourceItemUuid = "" } = {}) {
  const fields = {
    "system.wounds.value": 1, "system.wounds.critical": 0,
    ...conditionApplyFields("mimicWire", null, targetActor),
    "system.conditions.mimicWireBlocksPowers": !!blockPowers
  };
  await targetActor.update(fields);
  await establishControl(targetActor, attackerActor.uuid, { permanent: true, sourceItemUuid });
  await requestControlOwnership(targetActor, attackerActor);

  await _card(targetActor, "Поцелуй Мимика", `
    <div class="roll-threshold">1 Рана, обездвижен мононитью${blockPowers ? " (психосилы/техночудеса блокированы)" : ""} — под контролем ${esc(attackerActor.name)}.</div>
    <div class="wh-crit-pills">
      <button type="button" class="wh-mimic-wire-cut-btn" data-actor-uuid="${esc(targetActor.uuid)}" title="Вырвать мононить без хирургии — убивает цель">
        ${rollIcon("skull","#ff6b6b")} Оборвать нить</button>
      <button type="button" class="wh-mimic-wire-surgery-btn" data-actor-uuid="${esc(targetActor.uuid)}" title="16 часов, затем тест Medicae(I)−40">
        ${rollIcon("heart","#8fd0ff")} Начать хирургическое извлечение</button>
    </div>`);
}

/** Обрыв нити без хирургии — смерть цели (реюз deathButtonHtml/textAssertsDeath). */
export async function cutMimicWire(targetActor) {
  await targetActor.unsetFlag(SCOPE, MIMIC_WIRE_SURGERY_FLAG);
  const controllerActor = await _resolveController(targetActor);
  if (controllerActor) await requestRevokeControlOwnership(targetActor, controllerActor);
  await releaseControl(targetActor);
  await targetActor.update({
    ...conditionRemoveFields("mimicWire"),
    "system.conditions.mimicWireBlocksPowers": false
  });

  const deathText = "Мононить вырвана без хирургии — цель умирает мгновенно.";
  await _card(targetActor, "Мононить оборвана", `
    <div class="roll-threshold">${esc(deathText)}</div>
    ${deathButtonHtml(deathText, targetActor.uuid)}`);
}

/** Начать 16-часовую операцию извлечения. */
export async function startMimicWireSurgery(targetActor) {
  const deadline = scheduleMimicWireSurgery(game.time?.worldTime ?? 0);
  await targetActor.setFlag(SCOPE, MIMIC_WIRE_SURGERY_FLAG, deadline);
  await _card(targetActor, "Хирургическое извлечение начато", `
    <div class="roll-threshold">Через 16 игровых часов — тест Medicae(I)−40 на извлечение без вреда цели.</div>`);
}

/** Тик по игровому времени (Hooks.on("updateWorldTime"), тем же тактом, что Cast Out of Death). */
export async function checkMimicWireSurgery(actor, worldTime) {
  const deadline = actor.getFlag?.(SCOPE, MIMIC_WIRE_SURGERY_FLAG) ?? null;
  if (!isMimicWireSurgeryReady(deadline, worldTime)) return;
  await actor.unsetFlag(SCOPE, MIMIC_WIRE_SURGERY_FLAG);
  await _card(actor, "Хирургическое извлечение — 16ч прошло", `
    <div class="roll-threshold">Тест Medicae(I)−40 у оперирующего персонажа — по столу.</div>
    <div class="wh-crit-pills">
      <button type="button" class="wh-mimic-wire-extract-btn" data-actor-uuid="${esc(actor.uuid)}" title="Тест пройден — нить извлечена без вреда">
        ${rollIcon("heart","#8fd0ff")} Тест пройден — нить извлечена</button>
    </div>`);
}

/** Успешное извлечение — снимает всё чисто, без смерти. */
export async function confirmMimicWireExtraction(targetActor) {
  const controllerActor = await _resolveController(targetActor);
  if (controllerActor) await requestRevokeControlOwnership(targetActor, controllerActor);
  await releaseControl(targetActor);
  await targetActor.update({
    ...conditionRemoveFields("mimicWire"),
    "system.conditions.mimicWireBlocksPowers": false
  });
  await _card(targetActor, "Мононить извлечена", `<div class="roll-threshold">Без вреда, контроль снят.</div>`);
}

async function _resolveController(targetActor) {
  const uuid = controllerUuidOf(targetActor);
  return uuid ? await fromUuid(uuid).catch(() => null) : null;
}

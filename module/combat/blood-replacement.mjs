// module/combat/blood-replacement.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Карточка Ранения Замены Крови (правила — rules/blood-replacement.mjs,
//  wdbc-1rno.15). Зовётся из combat/damage.mjs на непоглощённом I/R/X уроне:
//  текст субмутации, список задетых в 2 м (замер сам, края Баз — rules/
//  aoe-target.mjs), у Дыма — кнопка зоны Дыма на носителе.
// ════════════════════════════════════════════════════════════════════════════

import { esc } from "../helpers/utils.mjs";
import { bloodWoundFor, bloodWoundVictims, BLOOD_WOUND_RADIUS_M, BLOOD_SMOKE_RADIUS_M } from "../rules/blood-replacement.mjs";
import { tokensWithinRadius } from "../rules/aoe-target.mjs";

export async function maybePostBloodWound(actor, { netDamage, damageType } = {}) {
  const wound = bloodWoundFor(actor, { netDamage, damageType });
  if (!wound) return null;
  const token = actor.getActiveTokens?.(false, true)?.[0] ?? null;
  const doc = token?.document ?? token;
  const near = doc ? tokensWithinRadius(doc, BLOOD_WOUND_RADIUS_M) : [];
  const side = doc?.disposition;
  const victims = bloodWoundVictims(wound, near, t => t.disposition !== side);
  const who = wound.who === "all" ? [esc(actor.name), ...victims.map(t => esc(t.name))] : victims.map(t => esc(t.name));
  const list = wound.who
    ? `<div class="roll-threshold">${who.length ? `Задеты (${BLOOD_WOUND_RADIUS_M} м): ${who.join(", ")}` : `В ${BLOOD_WOUND_RADIUS_M} м никого нет.`}</div>`
    : "";
  const smokeBtn = wound.smoke && doc
    ? `<button type="button" class="wh-blood-smoke-btn" data-token-uuid="${esc(doc.uuid)}">🌫️ Поставить дым (Smoke ${BLOOD_SMOKE_RADIUS_M}) на ${esc(actor.name)}</button>`
    : "";
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="wh-roll-result">
      <div class="roll-header">🩸 ${esc(actor.name)} — Замена Крови: ${esc(wound.label)}</div>
      <div class="roll-threshold">${esc(wound.text)}</div>
      ${list}${smokeBtn}
    </div>`
  });
  return wound;
}

/** Кнопка «Поставить дым»: зона Дыма радиусом 4 м с центром на токене носителя. */
export async function placeBloodSmoke(tokenUuid) {
  const doc = await fromUuid(tokenUuid).catch(() => null);
  if (!doc || !canvas?.ready) return ui.notifications.warn("⚠️ Токен носителя не найден на сцене.");
  const { blastCircleShape, pxPerMeter } = await import("./templates.mjs");
  const { placeSmokeZone } = await import("../regions/difficult-terrain.mjs");
  const center = doc.object?.center ?? { x: doc.x, y: doc.y };
  const shape = { ...blastCircleShape(BLOOD_SMOKE_RADIUS_M, pxPerMeter()), x: center.x, y: center.y };
  return placeSmokeZone(shape, "Дым из раны");
}

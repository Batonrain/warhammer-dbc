// module/combat/psychic-locus.mjs
// Психический Локус (rules/psychic-locus.mjs): кнопка Таланта бросает Psyniscience+0 и
// запоминает место по токену; locusHere меряет расстояние до него для окна манифестации.

import { esc, _degWord } from "../helpers/utils.mjs";
import { collectTestMods } from "../rules/roll-mods.mjs";
import { testOutcome } from "../rules/roll-outcome.mjs";
import { postTestCard, rollStatLine } from "../helpers/test-card.mjs";
import { PSYCHIC_LOCUS_FLAG, hasPsychicLocus, locusOf } from "../rules/psychic-locus.mjs";

const NS = "warhammer-dbc";

/** Где стоит псайкер относительно локуса: {sceneId, distanceM}. */
export function locusHere(actor) {
  const token = actor?.getActiveTokens?.(false)?.[0] ?? null;
  const loc = locusOf(actor);
  if (!token || !loc || !canvas?.ready) return { sceneId: "", distanceM: Infinity };
  const sceneId = canvas.scene?.id ?? "";
  if (sceneId !== loc.sceneId) return { sceneId, distanceM: Infinity };
  const c = token.center;
  const px = Math.hypot(c.x - loc.x, c.y - loc.y);
  const d = canvas.dimensions;
  return { sceneId, distanceM: (px / d.size) * d.distance };
}

/** Кнопка Таланта: 8 часов изучения, Psyniscience+0, при Успехе — новый локус (старый забыт). */
export async function studyPsychicLocus(actor) {
  if (!actor || !hasPsychicLocus(actor)) return ui.notifications.warn("⚠️ У актора нет Таланта Психический Локус.");
  const token = actor.getActiveTokens?.(false)?.[0] ?? null;
  if (!token || !canvas?.ready) return ui.notifications.warn("⚠️ Поставьте токен псайкера на изучаемое место.");
  const base = Number(actor.system?.skills?.psyniscience?.total) || 0;
  const rm = collectTestMods(actor, { kind: "skill", skill: "psyniscience", char: "per" });
  const threshold = base + rm.total;
  const roll = await new Roll("1d100").evaluate();
  const { success, deg } = testOutcome(roll.total, threshold);
  if (success) {
    await actor.setFlag(NS, PSYCHIC_LOCUS_FLAG, { sceneId: canvas.scene.id, x: token.center.x, y: token.center.y, successes: deg });
  }
  await postTestCard(actor, {
    icon: "🔮", title: `Психический Локус — ${esc(actor.name)}`,
    threshold: rollStatLine({ label: "Psyniscience", base, parts: rm.parts, threshold, rv: roll.total }),
    outcome: success
      ? `<span class="roll-success">Успех — ${deg} ${_degWord(deg)}. Место запомнено: в радиусе P.b×100 м бросок Феномена можно снизить на ${deg * 5}.</span>`
      : `<span class="roll-failure">Провал — ${deg} ${_degWord(deg)}. 8 часов изучения прошли впустую.</span>`
  }, { rolls: [roll] });
  return { success, deg };
}

/** Опереться на локус: −1 Успех места. Возвращает снижение Феномена (0 — не вышло). */
export async function spendPsychicLocus(actor, reduction) {
  const loc = locusOf(actor);
  if (!loc || !(reduction > 0)) return 0;
  await actor.setFlag(NS, PSYCHIC_LOCUS_FLAG, { ...loc, successes: Math.max(0, (Number(loc.successes) || 0) - 1) });
  return reduction;
}

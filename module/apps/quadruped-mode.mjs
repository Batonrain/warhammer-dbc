// module/apps/quadruped-mode.mjs
// ═══════════════════════════════════════════════════════════════════════════
//  Четвероногий (1): режим «на четвереньках» (SPD и Ношение ×2, руки заняты) /
//  «прямоходящий» (как без Трейта). Кнопка — запись kind:"script" на Черте
//  (dbc-114 / 55-15, 13.11.2026); правило и флаг — rules/quadruped.mjs.
// ═══════════════════════════════════════════════════════════════════════════

import { quadrupedTrait, isQuadrupedUpright, QUADRUPED_UPRIGHT_FLAG } from "../rules/quadruped.mjs";

export async function toggleQuadrupedMode(actor) {
  const trait = quadrupedTrait(actor);
  if (!trait) return ui.notifications.warn("Четвероногий: у персонажа нет такой Черты.");
  const rating = Number(trait.system?.rating) || 0;
  if (rating !== 1) {
    return ui.notifications.info(rating === 0
      ? "Четвероногий (0): всегда на четырёх конечностях, режим не выбирается."
      : "Четвероногий (2): «кентавр», режим не выбирается — SPD и Ношение всегда ×2.");
  }
  const upright = !isQuadrupedUpright(actor);
  await actor.setFlag("warhammer-dbc", QUADRUPED_UPRIGHT_FLAG, upright);
  ui.notifications.info(upright
    ? `${actor.name}: прямоходящий — SPD и Ношение как без Трейта.`
    : `${actor.name}: на четвереньках — SPD и Ношение ×2, пара рук занята.`);
}

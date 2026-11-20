// module/combat/warp-gifted.mjs
// Одарённый Варпом (rules/warp-gifted.mjs): кнопка Черты — выбрать свою
// психосилу и манифестировать её тестом W+5×X с PR X, без Феноменов.

import { esc } from "../helpers/utils.mjs";
import { warpGiftedRating, warpGiftedPowers, warpGiftedCastOpts, WARP_GIFTED_MAX_POWER_PR } from "../rules/warp-gifted.mjs";

export async function useWarpGifted(actor) {
  if (!actor) return false;
  const x = warpGiftedRating(actor);
  if (!x) {
    ui.notifications.warn(`${actor.name}: у Черты «Одарённый Варпом» не задан рейтинг X — впишите его на листе Черты.`);
    return false;
  }
  const powers = warpGiftedPowers(actor);
  if (!powers.length) {
    ui.notifications.warn(`${actor.name}: нет психосилы до PR${WARP_GIFTED_MAX_POWER_PR} — перетащите её на лист.`);
    return false;
  }
  let power = powers[0];
  if (powers.length > 1) {
    const id = await foundry.applications.api.DialogV2.wait({
      window: { title: "Одарённый Варпом" },
      content: `<p>Какую психосилу манифестировать (W+${5 * x}, PR ${x}, без Феноменов)?</p>`,
      buttons: powers.map((p, i) => ({ action: p.id, label: esc(p.name), default: i === 0 })),
      rejectClose: false
    }).catch(() => null);
    if (!id) return false;
    power = powers.find(p => p.id === id) ?? power;
  }
  const { executePsychotest } = await import("../sheets/tabs/psychic.mjs");
  await executePsychotest(actor, power, {
    ...warpGiftedCastOpts(x),
    modifier: 0, eldar: false, pushChoice: 1, damagePR: 0, rangePR: 0, profileIdx: -1, variantIdx: -1
  });
  return true;
}

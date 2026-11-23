// module/migrations/warp-gifted-rating.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Warp Gifted / Одарённый Варпом (X) — Рейтинг у уже выданных копий
//  (приёмка #597).
//
//  ЧТО СЛУЧИЛОСЬ. Кнопка «Манифестировать» (combat/warp-gifted.mjs) берёт X из
//  system.rating. В паке Черта получила hasRating:true, а копии, выданные
//  раньше, несут hasRating:false — поля Рейтинга на листе нет, и кнопка
//  просит вписать то, что вписать некуда.
//
//  ЧТО ДЕЛАЕТ. hasRating:true; X — из названия «(X)», если книга записала его
//  там и на копии ещё 0. Приём тот же, что nimble-rating.mjs. ИДЕМПОТЕНТНА:
//  копия с hasRating не трогается.
// ════════════════════════════════════════════════════════════════════════════

import { ratingFromName } from "./nimble-rating.mjs";
import { itemHasName } from "../rules/predicates.mjs";
import { unlinkedTokens } from "./unlinked-tokens.mjs";

/** Правка одной копии или null — трогать не нужно (чистая функция). */
export function warpGiftedRatingFix(item) {
  if (item?.type !== "trait" || item.system?.hasRating) return null;
  if (!itemHasName(item, "Warp Gifted") && !itemHasName(item, "Одарённый Варпом")) return null;
  const upd = { _id: item.id, "system.hasRating": true };
  const x = ratingFromName(item.name);
  if (x && !(Number(item.system?.rating) > 0)) upd["system.rating"] = x;
  return upd;
}

async function migrateOneActor(actor) {
  const updates = [...(actor.items ?? [])].map(warpGiftedRatingFix).filter(Boolean);
  if (!updates.length) return 0;
  await actor.updateEmbeddedDocuments("Item", updates);
  return updates.length;
}

export async function migrateWarpGiftedRating({ tokensOnly = false } = {}) {
  if (!game.user?.isGM) { ui.notifications?.warn("«Одарённый Варпом»: только для ГМа."); return; }
  let fixed = 0, failed = 0;
  const guarded = async (what, fn) => {
    try { fixed += await fn(); }
    catch (e) { failed++; console.error(`Warhammer DBC | «Одарённый Варпом»: сбой на «${what}», пропущено:`, e); }
  };
  if (!tokensOnly) {
    for (const actor of game.actors ?? []) await guarded(actor.name, () => migrateOneActor(actor));
  }
  for (const { scene, tokenDoc, actor } of unlinkedTokens()) {
    await guarded(`${tokenDoc.name} (${scene.name})`, () => migrateOneActor(actor));
  }
  const msg = `«Одарённый Варпом»: Рейтинг включён у копий — ${fixed}${failed ? `; ${failed} пропущено из-за ошибок — повторится при следующей загрузке мира` : ""}.`;
  console[failed ? "warn" : "log"]("Warhammer DBC |", msg);
  if (fixed || failed) ui.notifications?.[failed ? "warn" : "info"]("Warhammer DBC: " + msg);
  return { fixed, failed };
}

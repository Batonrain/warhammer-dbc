// module/apps/flesh-is-weak.mjs
//
// Foundry-часть Таланта «Flesh is Weak / Плоть Слаба» (чистая часть —
// rules/flesh-is-weak.mjs): держит рейтинг Трейта Machine в согласии с числом
// копий Таланта. Образец — apps/cybernetic-excellence.mjs: собственный вклад
// записан флагом fiwContribution НА САМОМ Трейте, поэтому рейтинг от других
// источников (раса, Кибернетическое Перерождение) не трогается, а при
// удалении Таланта вклад снимается ровно в размере записанного.
//
// Броня Machine — ActiveEffect «+X AP» на самом Трейте (AGENTS.md → Механика),
// и поднять один system.rating мало: эффекты пересчитываются под новый рейтинг
// тем же rescaleTraitByRating, что и при выдаче Черты (apps/mechanics.mjs).

import { rescaleTraitByRating } from "./mechanics.mjs";
import { planFleshIsWeak, FIW_CONTRIB_FLAG } from "../rules/flesh-is-weak.mjs";

const FLAG = "warhammer-dbc";

/** Подгоняет рейтинг Трейта Machine под число копий «Плоти Слабой». Безопасно звать чаще нужного. */
export async function syncFleshIsWeak(actor) {
  if (!actor || !(actor instanceof Actor)) return;
  const plan = planFleshIsWeak(actor.items);
  if (!plan) return;
  const { target, delta, contribution } = plan;

  const oldRating = Number(target.system?.rating) || 0;
  const nextRating = Math.max(0, oldRating + delta);

  // Эффекты брони — пересчитать под новый рейтинг (значение, равное старому рейтингу, → новому).
  const effects = [...(target.effects ?? [])];
  if (effects.length && oldRating && nextRating && oldRating !== nextRating) {
    const data = { system: { rating: oldRating }, effects: effects.map(e => ({ _id: e.id ?? e._id, system: { changes: structuredClone(e.system?.changes ?? e.changes ?? []) } })) };
    rescaleTraitByRating(data, nextRating);
    await target.updateEmbeddedDocuments("ActiveEffect",
      data.effects.map(e => ({ _id: e._id, "system.changes": e.system.changes })));
  }

  const update = { "system.rating": nextRating };
  if (contribution > 0) update[`flags.${FLAG}.${FIW_CONTRIB_FLAG}`] = contribution;
  else update[`flags.${FLAG}.-=${FIW_CONTRIB_FLAG}`] = null;
  await target.update(update);
}

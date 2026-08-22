// module/rules/psyker.mjs
//
// Базовый Пси-Рейтинг из Таланта «Psy Rating / Пси-Рейтинг» — без Foundry,
// принимает массив предметов актора (duck typing, как у armorAgilityCap).

import { itemHasName } from "./predicates.mjs";

/**
 * Базовый PR по Таланту на акторе, либо null, если Таланта нет — тогда
 * вызывающий не трогает хранимое system.psyker.rating (бестиарий/NPC задают
 * его статблоком, без предмета).
 *
 * Суммируется по ВСЕМ совпавшим предметам, а не берётся с одного: старые
 * персонажи брали Талант несколько раз отдельными предметами (книжное «за
 * каждое взятие +1 PR», hasRating тогда не было и rating=0 по умолчанию),
 * новые — одним предметом с полем Рейтинг (hasRating, как у Enemy (X)).
 * Math.max(rating, 1) на каждый предмет читает оба варианта одинаково верно,
 * не требуя миграции старых листов.
 */
export function psyRatingFromTalents(items) {
  const matches = [...(items ?? [])].filter(i => i?.type === "talent" && itemHasName(i, "Psy Rating"));
  if (!matches.length) return null;
  return matches.reduce((sum, i) => sum + Math.max(1, i.system?.rating || 0), 0);
}

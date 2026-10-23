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

/** Child of the Warp / Дитя Варпа: «+1 PR при Усиленной манифестации». */
export const CHILD_OF_THE_WARP_PUSH_BONUS = 1;

/**
 * Таланты, меняющие расчёт эPR манифестации (Sahara 3-28): Restraint /
 * Сдержанность (Безопасный режим) и Child of the Warp / Дитя Варпа (Усиленный).
 * Опознаются по имени (долг wdbc-iadw) — имена литералами в вызове itemHasName,
 * так их находит tools/capability-reachability.mjs.
 */
export function manifestEprFlags(actor) {
  let restraint = false, childOfWarp = false;
  for (const i of actor?.items ?? []) {
    if (i?.type !== "talent") continue;
    if (itemHasName(i, "Restraint") || itemHasName(i, "Сдержанность")) restraint = true;
    if (itemHasName(i, "Child of the Warp") || itemHasName(i, "Дитя Варпа")) childOfWarp = true;
  }
  return { restraint, childOfWarp };
}

/**
 * эПР Безопасного режима: ½ mPR с округлением вверх, а у носителя Сдержанности —
 * mPR−3 («как тПР−3 вместо ½тПР как обычно»). Берётся БОЛЬШЕЕ из двух: для PR 7+,
 * которым Талант доступен, mPR−3 не меньше половины, но манифестировать можно
 * и силой меньшего mPR — там «вместо» буквально ухудшило бы эПР, чего книга
 * явно не хочет.
 */
export function safeModeEpr(mPR, { restraint = false } = {}) {
  const half = Math.ceil(mPR / 2);
  return restraint ? Math.max(half, mPR - 3) : half;
}

/**
 * Был ли актор псайкером ДО предмета-источника (task-0469-bc1b, Метка Тзинча:
 * «связанный, если персонаж не был псайкером до этого»): стоит «Пси-Пробуждение»
 * (`system.isPsyker`) либо есть Трейт Psyker, выданный НЕ этим источником.
 *
 * Трейт, выданный самой Меткой, не считается — иначе вопрос «был ли» отвечал бы
 * «да» всякий раз, когда запись Метки отработала позже её же выдачи Трейта.
 * Выданные предметы несут `flags.warhammer-dbc.grantedByItem` = id источника
 * (apps/mechanics.mjs). Без Foundry: duck typing по `actor.items`.
 */
export function wasPsykerBefore(actor, sourceItem) {
  if (actor?.system?.isPsyker) return true;
  const sourceId = sourceItem?.id;
  return [...(actor?.items ?? [])].some(i =>
    i?.type === "trait" && itemHasName(i, "Psyker")
    && i.id !== sourceId
    && (!sourceId || i.flags?.["warhammer-dbc"]?.grantedByItem !== sourceId));
}

/**
 * Патч актора для Метки Тзинча: новый псайкер становится Связанным; тот, кто
 * уже был псайкером, остаётся каким был (Несвязанный не переписывается).
 * null — писать нечего. Разовую запись `system.psyker.class` потом не откатывает
 * ничто (в отличие от возможности `psyker.alwaysBound`, final-pools.mjs, которая
 * форсирует класс каждый пересчёт): Природа Дара остаётся обычным полем листа.
 */
export function tzeentchMarkBindUpdate(actor, sourceItem) {
  if (!actor?.system?.psyker) return null;
  if (wasPsykerBefore(actor, sourceItem)) return null;
  if (actor.system.psyker.class === "bound") return null;
  return { "system.psyker.class": "bound" };
}

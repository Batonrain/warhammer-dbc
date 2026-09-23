// module/migrations/unlinked-tokens.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Общее для прохода миграций по НЕСВЯЗАННЫМ токенам сцен (wdbc-gbd3).
//
//  У токена с actorLink:false нет своего актора целиком: tokenDoc.actor —
//  синтетический, это базовый мировой актор ПЛЮС дельта токена (ActorDelta).
//  Всё, чего дельта не переопределяет, берётся у базового актора, и правка
//  базового сразу пересчитывает синтетического (Foundry
//  client/documents/token.mjs _onUpdateBaseActor → actor-delta.mjs
//  updateSyntheticActor).
//
//  Отсюда правило: проход по токену трогает ТОЛЬКО то, что лежит в самой
//  дельте. Унаследованное уже прошло миграцию вместе с базовым актором, и
//  повтор на нём — либо лишняя запись в дельту, либо порча: инверсия знака
//  Мод. характеристик перевернула бы уже перевёрнутое обратно, простановка
//  «надето» заново надела бы то, что игрок снял.
// ════════════════════════════════════════════════════════════════════════════

/** Несвязанные токены всех сцен вместе с их синтетическим актором. */
export function* unlinkedTokens() {
  for (const scene of game.scenes ?? []) {
    for (const tokenDoc of scene.tokens?.contents ?? []) {
      if (tokenDoc.actorLink) continue;
      const actor = tokenDoc.actor;
      if (actor) yield { scene, tokenDoc, actor };
    }
  }
}

/**
 * Идентификаторы предметов, которые лежат в дельте токена: заведённые на
 * токене или правленные на нём. Надгробия (_tombstone — предмет базового
 * актора, удалённый на токене) не в счёт: предмета у токена нет.
 */
export function deltaItemIds(tokenDoc) {
  const items = tokenDoc?.delta?._source?.items ?? [];
  return new Set(items.filter(i => i && !i._tombstone).map(i => i._id));
}

/** Предметы синтетического актора, принадлежащие самому токену, а не базовому актору. */
export function deltaOwnedItems(tokenDoc) {
  const ids = deltaItemIds(tokenDoc);
  return [...(tokenDoc?.actor?.items ?? [])].filter(i => ids.has(i.id));
}

/** Поля system, записанные в самой дельте токена (без унаследованных). */
export function deltaSystem(tokenDoc) {
  return tokenDoc?.delta?._source?.system ?? {};
}

/**
 * Гейт одной миграции по двум ключам версии.
 *
 * `key` — версия самой миграции, как и раньше. `tokensKey` — отдельная версия
 * прохода по несвязанным токенам: он появился у миграций позже (стопка
 * #478-#481), и в мирах, где `key` уже стоит, без своего ключа не выполнился
 * бы никогда. Поднять `key` нельзя — повторный полный прогон портит данные у
 * тех миграций, что не переживают повтора (wdbc-gbd3).
 *
 * - `key` не пройден: полный прогон (он уже включает токены); при успехе
 *   ставятся оба ключа — второй раз по токенам идти незачем.
 * - `key` пройден, `tokensKey` нет: только проход по токенам.
 * - Частичный сбой (`failed`) — ключ не ставится, прогон повторится при
 *   следующей загрузке (wdbc-059h).
 *
 * @returns {Promise<"full"|"tokens"|"skip">} что было запущено
 */
export async function runMigrationGate({ key, tokensKey, version = 1, tokensVersion = 1,
                                         full, tokensOnly, label }) {
  const settings = game.settings;
  const get = (k) => Number(settings.get("warhammer-dbc", k)) || 0;
  const retry = `Warhammer DBC | ${label}: версия не проставлена из-за частичных ошибок, миграция повторится при следующей загрузке.`;
  try {
    if (get(key) < version) {
      const result = await full();
      if (result?.failed) { console.warn(retry); return "full"; }
      await settings.set("warhammer-dbc", key, version);
      await settings.set("warhammer-dbc", tokensKey, tokensVersion);
      return "full";
    }
    if (get(tokensKey) >= tokensVersion) return "skip";
    const result = await tokensOnly();
    if (result?.failed) console.warn(retry);
    else await settings.set("warhammer-dbc", tokensKey, tokensVersion);
    return "tokens";
  } catch (e) {
    console.error(`Warhammer DBC | ${label}:`, e);
    return "skip";
  }
}

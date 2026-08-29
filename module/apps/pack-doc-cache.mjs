// module/apps/pack-doc-cache.mjs
// ════════════════════════════════════════════════════════════════════════
//  Общий каркас для кэшей ПОЛНЫХ документов одного компендиума (Архетипы,
//  Расы, Корпуса кораблей — apps/archetypes.mjs, race-library.mjs,
//  ship-hull-library.mjs): читает пак, ловит ошибку, заводит авто-обновление
//  по готовности мира и правке пака. Индексные кэши (плоские поля сразу
//  нескольких паков) — другой приём, см. origin-shared.mjs::registerPackCache.
// ════════════════════════════════════════════════════════════════════════

/** Документы пака, или null — пак не найден/недоступен/упал. */
export async function loadPackDocuments(packId, warnLabel) {
  try {
    const pack = game.packs.get(packId);
    if (!pack) return null;
    return await pack.getDocuments();
  } catch (e) {
    console.warn(`Warhammer DBC | ${warnLabel}:`, e);
    return null;
  }
}

/** Кэш строится после готовности мира и обновляется при правках самого пака. */
export function registerPackCacheRefresh(packId, refreshFn) {
  Hooks.once("ready", () => refreshFn());
  for (const h of ["createItem", "deleteItem", "updateItem"])
    Hooks.on(h, (doc) => { if (doc?.pack === packId) refreshFn(); });
}

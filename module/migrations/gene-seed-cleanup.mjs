// module/migrations/gene-seed-cleanup.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Разовая чистка: убирает остатки СТАРОЙ системы Органов Геносемени.
//
//  Механизм снят целиком (19 предметов-органов, их компендиум, реестр на
//  вкладке ТЕЛО, категория имплантов "geneseed", авто-выдача космодесантнику
//  и связка «орган → Кислотный плевок»). Код удалён, но у уже сыгранных
//  персонажей предметы остались лежать на листах — эта миграция их и сносит,
//  чтобы новый механизм строился на чистом месте.
//
//  Под удаление попадает то, что могло появиться ТОЛЬКО из старой системы:
//   - имплант с system.category === "geneseed";
//   - что угодно с флагом warhammer-dbc.geneSeed (его ставили и органам,
//     и выданному ими оружию);
//   - оружие «Кислотный плевок (Железа Бетчера)» — боевой профиль органа,
//     своего смысла без него не имеет; на листе оно могло оказаться и без
//     флага (перетаскиванием из компендиума).
//
//  Чужие импланты (Механикус, бионика, биоимпланты Друкхари) не трогаются.
// ════════════════════════════════════════════════════════════════════════════

const SYSTEM = "warhammer-dbc";
const SPIT_NAME = "Кислотный плевок (Железа Бетчера)";

/** Остаток старой системы? Принимает документ или сырые данные предмета. */
export function isGeneSeedLeftover(item) {
  if (!item) return false;
  const system = item.system || {};
  const flags = item.flags?.[SYSTEM] || {};
  const flagged = item.getFlag ? item.getFlag(SYSTEM, "geneSeed") : flags.geneSeed;
  if (flagged) return true;
  if (item.type === "implant" && system.category === "geneseed") return true;
  return item.type === "weapon" && item.name === SPIT_NAME;
}

/** id предметов на удаление из переданной коллекции. */
export function geneSeedLeftoverIds(items = []) {
  return [...items].filter(isGeneSeedLeftover).map(i => i.id);
}

/**
 * Сносит остатки у акторов мира и среди предметов мира. Компендиумы системы
 * не трогает: они собираются из packs-src, откуда пак органов уже удалён.
 */
export async function migrateRemoveGeneSeed() {
  if (!game.user?.isGM) { ui.notifications?.warn("Чистка Геносемени: только для ГМа."); return; }
  let actorCount = 0, worldCount = 0;

  try {
    for (const actor of game.actors) {
      const ids = geneSeedLeftoverIds(actor.items);
      if (ids.length) { await actor.deleteEmbeddedDocuments("Item", ids); actorCount += ids.length; }
    }
  } catch (e) { console.error("Warhammer DBC | Чистка Геносемени (акторы):", e); }

  try {
    const ids = geneSeedLeftoverIds(game.items);
    if (ids.length) { await Item.deleteDocuments(ids); worldCount = ids.length; }
  } catch (e) { console.error("Warhammer DBC | Чистка Геносемени (мир):", e); }

  const msg = `Остатки Органов Геносемени удалены: у акторов ${actorCount}, в мире ${worldCount}.`;
  console.log("Warhammer DBC |", msg);
  if (actorCount || worldCount) ui.notifications?.info("Warhammer DBC: " + msg);
  return { actorCount, worldCount };
}

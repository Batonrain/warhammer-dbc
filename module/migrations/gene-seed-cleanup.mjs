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
 * Чистка остатков у ОДНОГО актора. Бросает исключение наружу — решение, что
 * делать со сбоем (пропустить и продолжить остальных), принимает вызывающий
 * код в migrateRemoveGeneSeed (тот же приём, что и в module/migrations/
 * gear-equipped.mjs).
 */
async function migrateOneActorGeneSeed(actor) {
  const ids = geneSeedLeftoverIds(actor.items);
  if (ids.length) await actor.deleteEmbeddedDocuments("Item", ids);
  return ids.length;
}

/**
 * Сносит остатки у акторов мира, у несвязанных токенов сцен (wdbc-059h, по
 * образцу gear-equipped/wdbc-dyi: у токена с actorLink:false предметы лежат в
 * его собственной ActorDelta, а не в мировом Actor) и среди предметов мира.
 * Компендиумы системы не трогает: они собираются из packs-src, откуда пак
 * органов уже удалён.
 *
 * Ошибка на одном акторе/токене логируется и пропускается, не прерывая
 * обработку следующих: остатки у разных персонажей друг от друга не зависят.
 */
export async function migrateRemoveGeneSeed() {
  if (!game.user?.isGM) { ui.notifications?.warn("Чистка Геносемени: только для ГМа."); return; }
  let actorCount = 0, worldCount = 0, failed = 0;

  // Мировые акторы. Связанные токены (actorLink:true) используют тот же
  // документ Actor — им отдельный проход не нужен.
  for (const actor of game.actors) {
    try {
      actorCount += await migrateOneActorGeneSeed(actor);
    } catch (e) {
      failed++;
      console.error(`Warhammer DBC | Чистка Геносемени: сбой на акторе «${actor.name}» (${actor.id}), пропущен:`, e);
    }
  }

  // Несвязанные токены сцен: их синтетический актор (tokenDoc.actor) пишет
  // прямо в ActorDelta токена.
  for (const scene of game.scenes ?? []) {
    for (const tokenDoc of scene.tokens?.contents ?? []) {
      if (tokenDoc.actorLink) continue;
      const actor = tokenDoc.actor;
      if (!actor) continue;
      try {
        actorCount += await migrateOneActorGeneSeed(actor);
      } catch (e) {
        failed++;
        console.error(`Warhammer DBC | Чистка Геносемени: сбой на токене «${tokenDoc.name}» сцены «${scene.name}» (${tokenDoc.id}), пропущен:`, e);
      }
    }
  }

  try {
    const ids = geneSeedLeftoverIds(game.items);
    if (ids.length) { await Item.deleteDocuments(ids); worldCount = ids.length; }
  } catch (e) {
    failed++;
    console.error("Warhammer DBC | Чистка Геносемени (мир):", e);
  }

  const msg = failed
    ? `Остатки Органов Геносемени удалены: у акторов ${actorCount}, в мире ${worldCount}; ${failed} акторов/токенов/групп пропущено из-за ошибок — миграция повторится при следующей загрузке мира.`
    : `Остатки Органов Геносемени удалены: у акторов ${actorCount}, в мире ${worldCount}.`;
  console[failed ? "warn" : "log"]("Warhammer DBC |", msg);
  if (actorCount || worldCount || failed) ui.notifications?.[failed ? "warn" : "info"]("Warhammer DBC: " + msg);
  return { actorCount, worldCount, failed };
}

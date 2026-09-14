// module/migrations/ship-hulls.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Одноразовый перевод Корпусов кораблей на отдельный тип предмета shipHull.
//
//  Раньше корпус был узлом (Item type "component", system.kind === "hull");
//  _prepareShipData теперь ищет только shipHull, и в старых мирах корабль
//  оставался без корпуса (spaceMax/powerGen/chars = 0), а легаси-узел ещё и
//  потреблял энергию как обычный компонент.
//
//  Миграция заменяет легаси-узел копией из компендиума ship-components:
//  сперва по _stats.compendiumSource, затем по имени (имена пака двуязычные —
//  «Sword / Меч», легаси мог носить любую половину). Не нашли соответствия —
//  узел НЕ трогаем: чужие данные дороже чистоты, о таких сообщаем в консоль.
// ════════════════════════════════════════════════════════════════════════════

const PACK = "warhammer-dbc.ship-components";

/** Легаси-Корпуса (узлы kind === "hull") среди предметов актора. */
export function legacyHullItems(items = []) {
  return [...items].filter(i => i.type === "component" && i.system?.kind === "hull");
}

/**
 * Документ пака для легаси-узла: по compendiumSource, затем по имени.
 * Двуязычное имя пака «Sword / Меч» матчится и целиком, и любой половиной.
 */
export function matchHullDoc(item, docs = []) {
  const src = item._stats?.compendiumSource;
  if (src) { const d = docs.find(x => x.uuid === src); if (d) return d; }
  const name = String(item.name || "").trim().toLowerCase();
  if (!name) return null;
  return docs.find(d => {
    const full = String(d.name || "").trim().toLowerCase();
    if (full === name) return true;
    return full.split("/").map(s => s.trim()).includes(name);
  }) || null;
}

/**
 * Перевод легаси-Корпусов ОДНОГО корабля-актора на тип shipHull. Бросает
 * исключение наружу — решение, что делать со сбоем (пропустить и продолжить
 * остальных), принимает вызывающий код в migrateShipHulls (тот же приём, что
 * и в module/migrations/gear-equipped.mjs). Возвращает {migrated, skipped}.
 */
async function migrateOneShipHulls(actor, docs) {
  let migrated = 0, skipped = 0;
  if (actor.type !== "ship") return { migrated, skipped };
  for (const legacy of legacyHullItems(actor.items)) {
    const doc = matchHullDoc(legacy, docs);
    if (!doc) {
      skipped++;
      console.warn(`Warhammer DBC | Корпус «${legacy.name}» (${actor.name}) не найден в паке — оставлен как есть.`);
      continue;
    }
    const data = doc.toObject();
    delete data._id;
    // Источник — как в apps/ship-hull.mjs::applyHull: пикер узнаёт текущий
    // Корпус по uuid библиотеки.
    data._stats = { ...(data._stats || {}), compendiumSource: doc.uuid };
    await actor.createEmbeddedDocuments("Item", [data]);
    await actor.deleteEmbeddedDocuments("Item", [legacy.id]);
    migrated++;
  }
  return { migrated, skipped };
}

/**
 * Переводит легаси-Корпуса всех кораблей мира на тип shipHull, а также
 * несвязанных токенов сцен (wdbc-059h, по образцу gear-equipped/wdbc-dyi) —
 * для кораблей это НЕ краевой случай: prototypeToken.actorLink у типа "ship"
 * по умолчанию false (см. warhammer-dbc.mjs, preCreateActor), то есть корабль
 * на сцене чаще всего именно непривязанный токен со своей ActorDelta, а не
 * запись в game.actors.
 *
 * Ошибка на одном акторе/токене логируется и пропускается, не прерывая
 * обработку следующих: Корпуса разных кораблей друг от друга не зависят.
 */
export async function migrateShipHulls() {
  if (!game.user?.isGM) { ui.notifications?.warn("Корпуса кораблей: только для ГМа."); return; }

  const pack = game.packs?.get(PACK);
  const docs = pack ? (await pack.getDocuments()).filter(d => d.type === "shipHull") : [];
  let migrated = 0, skipped = 0, failed = 0;

  // Мировые акторы. Связанные токены (actorLink:true) используют тот же
  // документ Actor — им отдельный проход не нужен.
  for (const actor of game.actors) {
    try {
      const res = await migrateOneShipHulls(actor, docs);
      migrated += res.migrated; skipped += res.skipped;
    } catch (e) {
      failed++;
      console.error(`Warhammer DBC | Корпуса кораблей: сбой на акторе «${actor.name}» (${actor.id}), пропущен:`, e);
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
        const res = await migrateOneShipHulls(actor, docs);
        migrated += res.migrated; skipped += res.skipped;
      } catch (e) {
        failed++;
        console.error(`Warhammer DBC | Корпуса кораблей: сбой на токене «${tokenDoc.name}» сцены «${scene.name}» (${tokenDoc.id}), пропущен:`, e);
      }
    }
  }

  const msg = failed
    ? `Корпуса кораблей переведены на shipHull: ${migrated}${skipped ? `, без соответствия ${skipped}` : ""}; ${failed} акторов/токенов пропущено из-за ошибок — миграция повторится при следующей загрузке мира.`
    : `Корпуса кораблей переведены на shipHull: ${migrated}${skipped ? `, без соответствия ${skipped}` : ""}.`;
  console[failed ? "warn" : "log"]("Warhammer DBC |", msg);
  if (migrated || skipped || failed) ui.notifications?.[failed ? "warn" : "info"]("Warhammer DBC: " + msg);
  return { migrated, skipped, failed };
}

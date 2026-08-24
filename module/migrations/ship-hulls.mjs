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

/** Переводит легаси-Корпуса всех кораблей мира на тип shipHull. */
export async function migrateShipHulls() {
  if (!game.user?.isGM) { ui.notifications?.warn("Корпуса кораблей: только для ГМа."); return; }

  const pack = game.packs?.get(PACK);
  const docs = pack ? (await pack.getDocuments()).filter(d => d.type === "shipHull") : [];
  let migrated = 0, skipped = 0;

  try {
    for (const actor of game.actors) {
      if (actor.type !== "ship") continue;
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
    }
  } catch (e) { console.error("Warhammer DBC | Корпуса кораблей:", e); }

  const msg = `Корпуса кораблей переведены на shipHull: ${migrated}${skipped ? `, без соответствия ${skipped}` : ""}.`;
  console.log("Warhammer DBC |", msg);
  if (migrated || skipped) ui.notifications?.info("Warhammer DBC: " + msg);
  return { migrated, skipped };
}

// module/apps/ship-hull-library.mjs
// ════════════════════════════════════════════════════════════════════════
//  Корпуса кораблей из компендиума (тип предмета "shipHull", пак
//  ship-components) — источник для пикера в шапке листа корабля
//  (sheets/hull-picker.mjs). Приём тот же, что у Рас (apps/race-library.mjs):
//  свой кэш полных документов, только чтение — применение см. ship-hull.mjs.
// ════════════════════════════════════════════════════════════════════════

import { loadPackDocuments, registerPackCacheRefresh } from "./pack-doc-cache.mjs";

const PACK = "warhammer-dbc.ship-components";

/** Порядок классов корпусов — как в Книге Пустоты. */
export const HULL_CLASS_ORDER = [
  "Транспорты", "Рейдеры", "Фрегаты", "Лёгкие крейсеры",
  "Крейсеры", "Линейные крейсеры", "Гранд-крейсеры", "Линкоры"
];

let CACHE = null;   // { id: HullDef }

const hullFromDoc = doc => ({
  id: doc.id, uuid: doc.uuid, name: doc.name,
  hullClass: doc.system?.hullClass || "",
  sp: doc.system?.sp || 0,
  hull: { ...(doc.system?.hull || {}) },
  chars: { ...(doc.system?.chars || {}) },
  shipProps: [...(doc.system?.shipProps || [])],
  aspects: doc.system?.aspects || "",
  desc: doc.system?.description || ""
});

/** Перечитать компендиум. Пустой/недоступный пак кэш не портит. */
export async function refreshHullCache() {
  const docs = await loadPackDocuments(PACK, "Кэш корпусов кораблей");
  if (!docs) return;
  const hulls = docs.filter(d => d.type === "shipHull").map(hullFromDoc);
  if (hulls.length) CACHE = Object.fromEntries(hulls.map(h => [h.id, h]));
}

/** { id: HullDef } — пусто, пока пак не прочитан. */
export function hullEntries() { return CACHE || {}; }

export function hullDef(id) { return hullEntries()[id] || null; }

/**
 * id библиотеки для уже установленного на корабле Корпуса (по uuid источника,
 * см. ship-hull.mjs::applyHull) — чтобы пикер отмечал текущий выбор галочкой.
 * null, если корпус поставлен вручную (не из библиотеки) или её ещё не читали.
 */
export function hullIdFromItem(item) {
  const src = item?._stats?.compendiumSource;
  if (!src) return null;
  return Object.values(hullEntries()).find(h => h.uuid === src)?.id || null;
}

/** Корпуса по классам, в порядке книги — для группировки в пикере. */
export function hullGroupList() {
  const all = Object.values(hullEntries());
  const seen = [...new Set(all.map(h => h.hullClass).filter(Boolean))]
    .sort((a, b) => HULL_CLASS_ORDER.indexOf(a) - HULL_CLASS_ORDER.indexOf(b));
  return seen.map(label => ({ label, hulls: all.filter(h => h.hullClass === label) }));
}

registerPackCacheRefresh(PACK, refreshHullCache);

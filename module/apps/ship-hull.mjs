// module/apps/ship-hull.mjs
// ════════════════════════════════════════════════════════════════════════
//  Применение Корпуса кораблю: снимает прежний (если был) и кладёт носитель
//  из библиотеки (ship-hull-library.mjs). На корабле всегда не больше одного
//  Корпуса — в отличие от узлов (тип "component"), выбор идёт через пикер в
//  шапке листа (sheets/hull-picker.mjs), а не через список Узлов.
// ════════════════════════════════════════════════════════════════════════

import { hullDef } from "./ship-hull-library.mjs";

/** Предмет-Корпус на актор-корабле (или null) — на корабле он всегда один. */
export function actorHullItem(actor) {
  return actor?.items?.find(i => i.type === "shipHull") || null;
}

/**
 * Ставит Корпус по id из библиотеки, снимая прежний. Пустой id — снять Корпус
 * без замены.
 */
export async function applyHull(actor, id) {
  if (!actor) return;
  const old = actorHullItem(actor);
  if (old) await actor.deleteEmbeddedDocuments("Item", [old.id]);
  if (!id) return;

  const def = hullDef(id);
  if (!def) return ui.notifications?.warn(`Корпус «${id}» не найден в библиотеке — установка отменена.`);

  const src = def.uuid ? await fromUuid(def.uuid).catch(() => null) : null;
  if (!src) {
    return ui.notifications?.warn(
      `⚠️ Библиотека корпусов не загружена — Корпус «${def.name}» не установлен. ` +
      `Дождитесь полной загрузки мира и выберите его ещё раз.`);
  }
  const data = src.toObject();
  delete data._id;
  // Явно проставляем источник: pickerу нужно узнавать текущий Корпус по uuid
  // библиотеки, а ручной createEmbeddedDocuments (не drag&drop) сам этого не
  // делает — в отличие от переноса предмета из компендиума мышью.
  data._stats = { ...(data._stats || {}), compendiumSource: def.uuid };
  await actor.createEmbeddedDocuments("Item", [data]);
  ui.notifications?.info(`🚀 Корпус: ${def.name}.`);
}

/** Снять Корпус без замены. */
export async function clearHull(actor) {
  const old = actorHullItem(actor);
  if (old) await actor.deleteEmbeddedDocuments("Item", [old.id]);
}

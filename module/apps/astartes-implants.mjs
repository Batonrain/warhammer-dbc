// module/apps/astartes-implants.mjs
// ════════════════════════════════════════════════════════════════════════
//  Боевые профили органов Геносемени (Кислотный плевок Железы Бетчера и
//  т.п.) — синхронизация с installed/disabled-состоянием органа. Связка
//  орган→оружие задаётся напрямую в module/constants/astartes-implants.mjs
//  (system.linkedWeapon → ASTARTES_IMPLANT_WEAPON_ITEMS), а не через
//  Конструктор Механики — поэтому и синк у неё свой, но по тому же принципу,
//  что syncGrantedEquipment в module/apps/mechanics.mjs: активен источник
//  (isItemActive, см. module/apps/effects.mjs) → оружие есть; неактивен —
//  оружия нет. Откат при удалении самого органа — общий deleteItem-хук
//  в warhammer-dbc.mjs (flags.warhammer-dbc.grantedByItem), тот же, что у
//  всего остального выданного.
// ════════════════════════════════════════════════════════════════════════

import { ASTARTES_IMPLANT_WEAPON_ITEMS, missingAstartesImplants } from "../constants/astartes-implants.mjs";
import { isItemActive } from "./effects.mjs";

const FLAG = "warhammer-dbc";

/**
 * Выдаёт космодесантнику недостающие органы Геносемени. Они не операция,
 * а часть тела, поэтому сразу помечаются вживлёнными — иначе их эффекты
 * не учитывались бы и они не попали бы на карту тела.
 * Железа Бетчера приносит с собой профиль кислотного плевка.
 */
export async function grantAstartesImplants(actor) {
  const missing = missingAstartesImplants(actor);
  if (!missing.length) return 0;

  const docs = missing.map(o => foundry.utils.mergeObject(
    foundry.utils.deepClone(o), { flags: { [FLAG]: { installed: true, geneSeed: true } } }));
  const created = await actor.createEmbeddedDocuments("Item", docs);

  // Боевые профили связанных органов — тот же синк, что держит их в актуальном
  // состоянии при установке/снятии органа далее (см. syncAstartesImplantWeapon).
  for (const item of created) if (item.system.linkedWeapon) await syncAstartesImplantWeapon(item);

  return missing.length;
}

/** Довыдаёт/убирает боевой профиль органа Геносемени по его текущему состоянию. */
export async function syncAstartesImplantWeapon(item) {
  if (item.type !== "implant" || !item.system?.linkedWeapon) return;
  const actor = item.parent;
  if (!(actor instanceof Actor)) return;

  const existing = actor.items.find(i => i.getFlag(FLAG, "grantedByItem") === item.id);
  if (!isItemActive(item)) {
    if (existing) await actor.deleteEmbeddedDocuments("Item", [existing.id]);
    return;
  }
  if (existing) return;
  // Не дублировать, если такое оружие уже есть на листе (вручную добавлено / от другого источника).
  if (actor.items.some(i => i.type === "weapon" && i.name === item.system.linkedWeapon)) return;

  const def = ASTARTES_IMPLANT_WEAPON_ITEMS.find(w => w.name === item.system.linkedWeapon);
  if (!def) return;
  const data = foundry.utils.mergeObject(foundry.utils.deepClone(def),
    { flags: { [FLAG]: { geneSeed: true, grantedByItem: item.id } } });
  await actor.createEmbeddedDocuments("Item", [data]);
}

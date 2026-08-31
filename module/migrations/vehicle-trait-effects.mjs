// module/migrations/vehicle-trait-effects.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Дополнение system.effects встроенных Черт техники ключами из компендиума.
//
//  Третья стопка (wdbc-y33b/8nz6/m38e) завела 16 новых флагов effects у
//  vehicleTrait; ObjectField применяет initial только когда ключа effects нет
//  вовсе — снимки Черт, уже вложенные в акторов-технику (и в пак vehicles),
//  остались со старым набором и все новые Черты молча ничего не делали.
//  Пак пересинхронизирован сборкой; этот проход догоняет ЖИВЫЕ миры.
//
//  Идемпотентно: добавляются только ОТСУТСТВУЮЩИЕ ключи, существующие значения
//  (rating и правки ГМа) не трогаются. Не нашли каноническую запись по имени —
//  Черту не трогаем: чужие данные дороже чистоты (тот же принцип, что у
//  ship-hulls.mjs).
// ════════════════════════════════════════════════════════════════════════════

const PACK = "warhammer-dbc.vehicle-traits";

// Ключи, у которых третья стопка сменила СЕМАНТИКУ (число → флаг): старое
// значение 0 на копии — не «авторская правка», а мёртвый рудимент, его надо
// перезаписать каноном, иначе truthy-гейт читателя не сработает никогда.
const SEMANTIC_CHANGED_KEYS = ["spdDamageReduce"];

/** Ключи effects, которых нет в current (или сменивших семантику и falsy),
 *  со значениями из canon (чистая часть). */
export function missingEffectKeys(canon = {}, current = {}) {
  const out = {};
  for (const [k, v] of Object.entries(canon)) {
    if (!(k in current)) { out[k] = v; continue; }
    if (SEMANTIC_CHANGED_KEYS.includes(k) && v && !current[k]) out[k] = v;
  }
  return out;
}

/** Каноническая запись пака по имени встроенной Черты: «A / Б» матчится
 *  половинами, рейтинг «(4)» приводится к шаблонному «(X)» — иначе
 *  «Демонический (4)» не находил канон «Демонический (X)» нигде. */
export function matchTraitDoc(name, docs = []) {
  const norm = s => String(s || "").trim().toLowerCase().replace(/\(\s*[\d½]+\s*\)/g, "(x)");
  const n = norm(name);
  if (!n) return null;
  return docs.find(d => {
    const full = norm(d.name);
    if (full === n) return true;
    return full.split("/").map(x => x.trim()).includes(n);
  }) || null;
}

/** Догоняет встроенные Черты всех акторов-техники мира. */
export async function migrateVehicleTraitEffects() {
  if (!game.user?.isGM) { ui.notifications?.warn("Черты техники: только для ГМа."); return; }
  const pack = game.packs?.get(PACK);
  if (!pack) { console.warn("Warhammer DBC | Черты техники: пак недоступен, проход пропущен"); return; }
  const docs = await pack.getDocuments();

  let patchedActors = 0, patchedTraits = 0;
  for (const actor of game.actors ?? []) {
    if (actor.type !== "vehicle") continue;
    const updates = [];
    for (const item of actor.items) {
      if (item.type !== "vehicleTrait") continue;
      const canon = matchTraitDoc(item.name, docs)?.system?.effects;
      if (!canon) continue;
      const add = missingEffectKeys(canon, item.system?.effects ?? {});
      if (!Object.keys(add).length) continue;
      const patch = { _id: item.id };
      for (const [k, v] of Object.entries(add)) patch[`system.effects.${k}`] = v;
      updates.push(patch);
      patchedTraits++;
    }
    if (updates.length) {
      await actor.updateEmbeddedDocuments("Item", updates);
      patchedActors++;
    }
  }
  if (patchedTraits) {
    console.log(`Warhammer DBC | Черты техники: дополнено ${patchedTraits} Черт у ${patchedActors} машин`);
  }
}

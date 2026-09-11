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

/**
 * Догоняет встроенные Черты ОДНОГО актора-техники. Бросает исключение
 * наружу — решение, что делать со сбоем (пропустить и продолжить остальных),
 * принимает вызывающий код в migrateVehicleTraitEffects (тот же приём, что и
 * в module/migrations/gear-equipped.mjs). Возвращает число дополненных Черт
 * (0, если актор не техника или дополнять нечего).
 */
async function migrateOneActorVehicleTraitEffects(actor, docs) {
  if (actor.type !== "vehicle") return 0;
  const updates = [];
  let patchedTraits = 0;
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
  if (updates.length) await actor.updateEmbeddedDocuments("Item", updates);
  return patchedTraits;
}

/**
 * Догоняет встроенные Черты всех акторов-техники мира, а также несвязанных
 * токенов сцен (wdbc-059h, по образцу gear-equipped/wdbc-dyi): у токена с
 * actorLink:false предметы лежат в его собственной ActorDelta, а не в мировом
 * Actor — такой токен не входит в game.actors и без отдельного прохода
 * остался бы не замечен.
 *
 * Раньше цикл по акторам не был защищён вовсе (ни общим, ни поштучным
 * try/catch) — сбой на одной машине обрывал весь проход и оставлял без
 * догонки все машины ПОСЛЕ неё в этом же запуске (не только саму
 * сбойную) — тот же класс бага, что общий try на весь цикл. Теперь ошибка
 * на одном акторе/токене логируется и пропускается, не прерывая обработку
 * следующих: Черты разных машин друг от друга не зависят.
 */
export async function migrateVehicleTraitEffects() {
  if (!game.user?.isGM) { ui.notifications?.warn("Черты техники: только для ГМа."); return; }
  const pack = game.packs?.get(PACK);
  if (!pack) { console.warn("Warhammer DBC | Черты техники: пак недоступен, проход пропущен"); return { patchedActors: 0, patchedTraits: 0, failed: 0 }; }
  const docs = await pack.getDocuments();

  let patchedActors = 0, patchedTraits = 0, failed = 0;

  // Мировые акторы. Связанные токены (actorLink:true) используют тот же
  // документ Actor — им отдельный проход не нужен.
  for (const actor of game.actors ?? []) {
    try {
      const n = await migrateOneActorVehicleTraitEffects(actor, docs);
      if (n) { patchedTraits += n; patchedActors++; }
    } catch (e) {
      failed++;
      console.error(`Warhammer DBC | Черты техники: сбой на акторе «${actor?.name}» (${actor?.id}), пропущен:`, e);
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
        const n = await migrateOneActorVehicleTraitEffects(actor, docs);
        if (n) { patchedTraits += n; patchedActors++; }
      } catch (e) {
        failed++;
        console.error(`Warhammer DBC | Черты техники: сбой на токене «${tokenDoc.name}» сцены «${scene.name}» (${tokenDoc.id}), пропущен:`, e);
      }
    }
  }

  if (patchedTraits) {
    console.log(`Warhammer DBC | Черты техники: дополнено ${patchedTraits} Черт у ${patchedActors} машин`);
  }
  if (failed) console.warn(`Warhammer DBC | Черты техники: ${failed} акторов/токенов пропущено из-за ошибок — миграция повторится при следующей загрузке мира.`);
  return { patchedActors, patchedTraits, failed };
}

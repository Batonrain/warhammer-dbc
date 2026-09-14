// module/migrations/tech-power-costs.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Одноразовая довыдача цен Техночудес существующим акторам.
//
//  Цены проставлены в компендиуме tech-powers (160 предметов, было cost: 0),
//  и статья Опыта spentTech считает по цене ВЛОЖЕННОЙ копии предмета. У
//  акторов, собранных до этого, копии несут cost: 0 — статья молча показывала
//  бы ноль. Миграция подтягивает цену из компендиума: сперва по
//  _stats.compendiumSource, затем по имени в паке tech-powers.
//
//  Цена, уже правленная руками (cost !== 0), не трогается: поле редактируемо
//  на листе (tab-tech.hbs, tech-cost-input), и ручное значение — решение ГМа.
// ════════════════════════════════════════════════════════════════════════════

/** Вложенные Техночудеса с непроставленной ценой. */
export function zeroCostTechPowers(items = []) {
  return [...items].filter(i => i.type === "techPower" && !(Number(i.system?.cost) || 0));
}

/**
 * Цена для вложенной копии из документов компендиума.
 * `byUuid` — Map uuid→doc (по _stats.compendiumSource), `byName` — Map name→doc.
 * Возвращает число или null, если источник не найден или у него та же нулевая цена.
 */
export function costFromCompendium(item, byUuid, byName) {
  const src = item._stats?.compendiumSource;
  const doc = (src && byUuid.get(src)) || byName.get(item.name) || null;
  const cost = Number(doc?.system?.cost) || 0;
  return cost > 0 ? cost : null;
}

/**
 * Довыдача цен Техночудес ОДНОМУ актору. Бросает исключение наружу — решение,
 * что делать со сбоем (пропустить и продолжить остальных), принимает вызывающий
 * код в migrateTechPowerCosts, у этой функции нет доступа к «сколько акторов
 * ещё впереди» (тот же приём, что и в module/migrations/gear-equipped.mjs).
 */
async function migrateOneActorTechPowerCosts(actor, byUuid, byName) {
  const updates = [];
  for (const item of zeroCostTechPowers(actor.items)) {
    const cost = costFromCompendium(item, byUuid, byName);
    if (cost !== null) updates.push({ _id: item.id, "system.cost": cost });
  }
  if (updates.length) await actor.updateEmbeddedDocuments("Item", updates);
  return updates.length;
}

/**
 * Довыдаёт цены Техночудес всем акторам мира, а также несвязанным токенам
 * сцен (wdbc-059h, по образцу gear-equipped/wdbc-dyi): у токена с
 * actorLink:false Техночудеса лежат в его собственной ActorDelta, а не в
 * мировом Actor — такой токен не входит в game.actors и без отдельного
 * прохода остался бы не замечен.
 *
 * Ошибка на одном акторе/токене логируется и пропускается, не прерывая
 * обработку следующих: копии Техночудес разных персонажей друг от друга не
 * зависят.
 */
export async function migrateTechPowerCosts() {
  if (!game.user?.isGM) { ui.notifications?.warn("Цены Техночудес: только для ГМа."); return; }

  const pack = game.packs?.get("warhammer-dbc.tech-powers");
  const docs = pack ? await pack.getDocuments() : [];
  const byUuid = new Map(docs.map(d => [d.uuid, d]));
  const byName = new Map(docs.map(d => [d.name, d]));
  let updated = 0;
  let failed = 0;

  // Мировые акторы. Связанные токены (actorLink:true) используют тот же
  // документ Actor — им отдельный проход не нужен.
  for (const actor of game.actors) {
    try {
      updated += await migrateOneActorTechPowerCosts(actor, byUuid, byName);
    } catch (e) {
      failed++;
      console.error(`Warhammer DBC | Цены Техночудес: сбой на акторе «${actor.name}» (${actor.id}), пропущен:`, e);
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
        updated += await migrateOneActorTechPowerCosts(actor, byUuid, byName);
      } catch (e) {
        failed++;
        console.error(`Warhammer DBC | Цены Техночудес: сбой на токене «${tokenDoc.name}» сцены «${scene.name}» (${tokenDoc.id}), пропущен:`, e);
      }
    }
  }

  const msg = failed
    ? `Цены Техночудес довыданы: ${updated} предметов; ${failed} акторов/токенов пропущено из-за ошибок — миграция повторится при следующей загрузке мира.`
    : `Цены Техночудес довыданы: ${updated} предметов.`;
  console[failed ? "warn" : "log"]("Warhammer DBC |", msg);
  if (updated || failed) ui.notifications?.[failed ? "warn" : "info"]("Warhammer DBC: " + msg);
  return { updated, failed };
}

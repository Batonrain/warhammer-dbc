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

/** Довыдаёт цены Техночудес всем акторам мира. */
export async function migrateTechPowerCosts() {
  if (!game.user?.isGM) { ui.notifications?.warn("Цены Техночудес: только для ГМа."); return; }

  const pack = game.packs?.get("warhammer-dbc.tech-powers");
  const docs = pack ? await pack.getDocuments() : [];
  const byUuid = new Map(docs.map(d => [d.uuid, d]));
  const byName = new Map(docs.map(d => [d.name, d]));
  let updated = 0;

  try {
    for (const actor of game.actors) {
      const updates = [];
      for (const item of zeroCostTechPowers(actor.items)) {
        const cost = costFromCompendium(item, byUuid, byName);
        if (cost !== null) updates.push({ _id: item.id, "system.cost": cost });
      }
      if (updates.length) { await actor.updateEmbeddedDocuments("Item", updates); updated += updates.length; }
    }
  } catch (e) { console.error("Warhammer DBC | Цены Техночудес:", e); }

  const msg = `Цены Техночудес довыданы: ${updated} предметов.`;
  console.log("Warhammer DBC |", msg);
  if (updated) ui.notifications?.info("Warhammer DBC: " + msg);
  return { updated };
}

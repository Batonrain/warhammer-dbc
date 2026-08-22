// module/apps/aspirations.mjs
// ════════════════════════════════════════════════════════════════════════
//  Стремления (Black Crusade, стр. 22): выбор в шапке листа читает и
//  компендиум warhammer-dbc.aspirations, и предметы-Стремления, заведённые в
//  самом мире. Своё Стремление можно завести любым из двух способов — в
//  библиотеке или прямо кнопкой «Создать предмет», — и оно окажется в списке.
//
//  Раньше мир не читался вовсе: список собирался из одного компендиума, и
//  созданное за столом Стремление просто не появлялось, без единого слова.
//
//  Сведение источников — в rules/aspiration-sources.mjs: там же ключ для
//  предмета мира (у него своего ключа обычно нет) и защита от повторов.
// ════════════════════════════════════════════════════════════════════════

import { aspirationLibrary } from "../constants/aspirations.mjs";
import { registerPackCache, packEntries } from "./origin-shared.mjs";
import { aspirationChoices, findAspiration, WORLD_KEY_PREFIX } from "../rules/aspiration-sources.mjs";
import { applyItemMechanics } from "./mechanics.mjs";
import { SKIP_MECHANICS_HOOK } from "./races.mjs";

const PACK = "warhammer-dbc.aspirations";
export const ASPIRATION_TAG = "aspiration";

registerPackCache(PACK, ASPIRATION_TAG);

const fallbackEntries = () => aspirationLibrary().map(a => ({
  key: a.system.key, name: a.name, table: a.system.table, n: a.system.n,
  mods: a.system.mods, description: a.system.description
}));

/** Стремления, заведённые в мире. Вне игры (тесты) их просто нет. */
const worldItems = () => {
  try { return game.items?.filter?.(i => i.type === "aspiration") ?? []; }
  catch { return []; }
};

/** Опции выпадающего списка для таблицы (pride/motivation/disgrace). */
export function aspirationOptions(table) {
  return aspirationChoices(packEntries(ASPIRATION_TAG, fallbackEntries), worldItems(), table);
}

/** Запись по ключу: сперва компендиум и константы, затем предметы мира. */
export function aspirationByKey(key) {
  const found = findAspiration(packEntries(ASPIRATION_TAG, fallbackEntries), worldItems(), key);
  return found ? { ...found, id: found.key, desc: found.description } : null;
}

// ── Автоматизация бонусов (Механика) ────────────────────────────────────
// Выбор Стремления в слоте только ссылался на ключ — сам бонус («+5 Inf, +5 F,
// −5 W») был текстом-подсказкой, применялся игроком руками. Библиотека
// (packs-src/aspirations) теперь несёт структурную Механику, как Расы и
// Родные миры, — не хватало только фактического НОСИТЕЛЯ: без embedded Item
// на акторе Конструктору нечего применять. grantAspiration клонирует предмет
// Стремления (компендиум или мир) на актора, помечая слотом; глобальный хук
// createItem (warhammer-dbc.mjs) сам вызывает applyItemMechanics для него —
// вызывать её здесь самим не нужно, в отличие от applyRace (там гонка с тем
// же хуком, см. SKIP_MECHANICS_HOOK).
const SLOT_FLAG = "aspirationSlot";

/** Предмет-источник Стремления по ключу: компендиум, константы или мир. */
async function resolveAspirationSource(key) {
  if (!key) return null;
  if (key.startsWith(WORLD_KEY_PREFIX)) {
    return game.items?.get(key.slice(WORLD_KEY_PREFIX.length)) ?? null;
  }
  const entry = aspirationByKey(key);
  if (!entry) return null;
  if (entry.world) {
    return game.items?.find(i => i.type === "aspiration" && i.system?.key === key) ?? null;
  }
  return entry.uuid ? fromUuid(entry.uuid) : null;
}

/** Снимает ранее выданное Стремление слота idx (если было). */
export async function clearAspirationGrant(actor, idx) {
  const olds = actor.items.filter(i => i.type === "aspiration" && i.getFlag("warhammer-dbc", SLOT_FLAG) === idx);
  if (olds.length) await actor.deleteEmbeddedDocuments("Item", olds.map(i => i.id));
}

/**
 * Выдаёт Стремление слота idx как embedded Item — носитель его Механики.
 * Своё (custom, без key) не выдаёт ничего: у него нет предмета-источника,
 * бонус остаётся текстом, как и раньше.
 */
export async function grantAspiration(actor, idx, key) {
  await clearAspirationGrant(actor, idx);
  const src = await resolveAspirationSource(key);
  if (!src) return;
  const data = src.toObject();
  delete data._id;
  // Компендиумный источник может уже нести собственные синхронизированные
  // ActiveEffect (syncMechanicsEffects проходит и по компендиумам) — копия
  // унесла бы их вместе с предметом. Свежая копия получает эффекты только из
  // applyItemMechanics ниже, поэтому уезжает пустой.
  data.effects = [];
  data.flags = { ...(data.flags || {}), "warhammer-dbc": { ...(data.flags?.["warhammer-dbc"] || {}), [SLOT_FLAG]: idx } };
  // SKIP_MECHANICS_HOOK + прямой вызов applyItemMechanics — тот же приём, что
  // и в applyRace (races.mjs): в этом окружении глобальный хук createItem
  // срабатывает на один createEmbeddedDocuments дважды (проверено вживую —
  // без флага бонус задваивался, Inf/Fel/WP уезжали ×2), и полагаться на то,
  // что хук применит Механику ровно один раз, нельзя.
  const [created] = await actor.createEmbeddedDocuments("Item", [data], { [SKIP_MECHANICS_HOOK]: true });
  if (created) await applyItemMechanics(created);
}

/**
 * Разовая миграция: у персонажей, выбравших Стремление ДО этой автоматизации,
 * слот несёт ключ, но носителя-предмета ещё нет — бонус не считается, хотя
 * подсказка на листе выглядит как обычно. Дополняет только недостающее, не
 * трогает custom-слоты (там нет предмета-источника) и уже выданные.
 */
export async function backfillAspirationGrants() {
  let granted = 0;
  for (const actor of game.actors ?? []) {
    const slots = actor.system?.aspirations?.slots;
    if (!Array.isArray(slots)) continue;
    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];
      const key = slot?.id || (typeof slot === "string" ? slot : "");
      if (!key || slot?.custom) continue;
      const already = actor.items.some(it => it.type === "aspiration" && it.getFlag("warhammer-dbc", SLOT_FLAG) === i);
      if (already) continue;
      try { await grantAspiration(actor, i, key); granted++; }
      catch (e) { console.warn(`Warhammer DBC | Довыдача Стремления ${actor.name}[${i}]:`, e); }
    }
  }
  if (granted) console.log(`Warhammer DBC | Стремления: довыдано ${granted} носителей Механики задним числом.`);
  return granted;
}

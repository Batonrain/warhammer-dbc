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
import { applyItemMechanics, blankMechEntry, blankMechGroup } from "./mechanics.mjs";
import { SKIP_MECHANICS_HOOK } from "./races.mjs";
import { CHARACTERISTICS } from "../constants/characteristics.mjs";
import { CHAR_PICK_FLAG, normalizeCharPick, validateCharPick, charPickChanges, charPickState } from "../rules/aspiration-char-pick.mjs";

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
 * Диалог выбора Характеристик для Стремления с флагом `charPick`
 * («Совершенство»: +5 одной, −3 двум другим). Неверный ответ спрашивается
 * заново с причиной; null — окно закрыли или отменили.
 */
export async function askCharPick(rule, name = "") {
  const keys = Object.keys(CHARACTERISTICS);
  const opts = (sel) => keys.map((k, i) =>
    `<option value="${k}" ${i === sel ? "selected" : ""}>${foundry.utils.escapeHTML(CHARACTERISTICS[k].label)} (${CHARACTERISTICS[k].abbr})</option>`).join("");
  const minusRows = Array.from({ length: rule.minusCount }, (_, i) =>
    `<label>−${rule.minus}: <select name="minus${i}">${opts(i + 1)}</select></label>`).join("<br>");
  const content = `<p>«${foundry.utils.escapeHTML(name)}»: +${rule.plus} одной Характеристике по выбору и −${rule.minus} ${rule.minusCount === 2 ? "двум другим" : `${rule.minusCount} другим`}.</p>
    <label>+${rule.plus}: <select name="plus">${opts(0)}</select></label><br>${minusRows}`;
  for (;;) {
    const pick = await foundry.applications.api.DialogV2.prompt({
      window: { title: `Выбор — ${name}` },
      content,
      ok: {
        label: "Применить",
        callback: (_ev, btn) => ({
          plus: btn.form.elements.plus.value,
          minus: Array.from({ length: rule.minusCount }, (_, i) => btn.form.elements[`minus${i}`].value)
        })
      }
    }).catch(() => null);
    if (!pick) return null;
    const v = validateCharPick(rule, pick, keys);
    if (v.ok) return pick;
    ui.notifications?.warn(v.reason);
  }
}

/** Записи Конструктора из ответа игрока — три обычных `characteristic` в одной И-группе. */
function charPickMechanics(rule, pick) {
  const group = blankMechGroup("AND");
  group.entries = charPickChanges(rule, pick, Object.keys(CHARACTERISTICS)).map(c => ({
    ...blankMechEntry("characteristic"), charKey: c.charKey, field: "total", op: c.op, value: c.value
  }));
  return [group];
}

/**
 * Выдаёт Стремление слота idx как embedded Item — носитель его Механики.
 * Своё (custom, без key) не выдаёт ничего: у него нет предмета-источника,
 * бонус остаётся текстом, как и раньше.
 *
 * Стремление с флагом `charPick` («Совершенство») перед выдачей спрашивает
 * игрока и записывает ответ обычными записями Конструктора в КОПИЮ у актора.
 * `prompt:false` (довыдача задним числом) такие не выдаёт: окно с вопросом
 * посреди загрузки мира для каждого персонажа — хуже, чем подождать, пока
 * игрок выберет заново сам.
 * @returns {Promise<"granted"|"none"|"cancelled">}
 */
export async function grantAspiration(actor, idx, key, { prompt = true } = {}) {
  const src = await resolveAspirationSource(key);
  if (!src) { await clearAspirationGrant(actor, idx); return "none"; }
  const data = src.toObject();
  delete data._id;
  const pickRule = normalizeCharPick(data.flags?.["warhammer-dbc"]?.[CHAR_PICK_FLAG]);
  let chosenPick = null;
  if (pickRule) {
    if (!prompt) return "none";
    // Вопрос ДО снятия прежней выдачи: отказавшийся не теряет то, что было.
    chosenPick = await askCharPick(pickRule, data.name);
    if (!chosenPick) return "cancelled";
  }
  await clearAspirationGrant(actor, idx);
  // Компендиумный источник может уже нести собственные синхронизированные
  // ActiveEffect (syncMechanicsEffects проходит и по компендиумам) — копия
  // унесла бы их вместе с предметом. Свежая копия получает эффекты только из
  // applyItemMechanics ниже, поэтому уезжает пустой.
  data.effects = [];
  data.flags = { ...(data.flags || {}), "warhammer-dbc": { ...(data.flags?.["warhammer-dbc"] || {}), [SLOT_FLAG]: idx } };
  if (chosenPick) {
    // Ответ игрока запоминается рядом с записями — по нему видно, что выбрано.
    data.flags["warhammer-dbc"].mechanics = charPickMechanics(pickRule, chosenPick);
    data.flags["warhammer-dbc"].charPickChosen = chosenPick;
  }
  // SKIP_MECHANICS_HOOK + прямой вызов applyItemMechanics — тот же приём, что
  // и в applyRace (races.mjs): в этом окружении глобальный хук createItem
  // срабатывает на один createEmbeddedDocuments дважды (проверено вживую —
  // без флага бонус задваивался, Inf/Fel/WP уезжали ×2), и полагаться на то,
  // что хук применит Механику ровно один раз, нельзя.
  const [created] = await actor.createEmbeddedDocuments("Item", [data], { [SKIP_MECHANICS_HOOK]: true });
  if (created) await applyItemMechanics(created);
  return "granted";
}

/**
 * Состояние выбора Характеристик у слота idx ("none"/"needed"/"chosen") —
 * для кнопки «Выбрать Характеристики» на листе и в Мастере. Правило берётся из
 * записи библиотеки (по ключу слота), ответ — с выданной копии у актора:
 * копия, созданная до появления выбора, ответа не несёт.
 */
export function aspirationPickState(actor, idx, entry) {
  const item = actor.items.find(i => i.type === "aspiration" && i.getFlag("warhammer-dbc", SLOT_FLAG) === idx);
  return charPickState(entry?.charPick, item?.getFlag("warhammer-dbc", "charPickChosen"));
}

/**
 * Разовая миграция: у персонажей, выбравших Стремление ДО этой автоматизации,
 * слот несёт ключ, но носителя-предмета ещё нет — бонус не считается, хотя
 * подсказка на листе выглядит как обычно. Дополняет только недостающее, не
 * трогает custom-слоты (там нет предмета-источника), слоты «без
 * модификаторов» (игрок отказался от бонусов) и уже выданные.
 */
export async function backfillAspirationGrants() {
  let granted = 0;
  for (const actor of game.actors ?? []) {
    const slots = actor.system?.aspirations?.slots;
    if (!Array.isArray(slots)) continue;
    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];
      const key = slot?.id || (typeof slot === "string" ? slot : "");
      if (!key || slot?.custom || slot?.noMods) continue;
      const already = actor.items.some(it => it.type === "aspiration" && it.getFlag("warhammer-dbc", SLOT_FLAG) === i);
      if (already) continue;
      try { if (await grantAspiration(actor, i, key, { prompt: false }) === "granted") granted++; }
      catch (e) { console.warn(`Warhammer DBC | Довыдача Стремления ${actor.name}[${i}]:`, e); }
    }
  }
  if (granted) console.log(`Warhammer DBC | Стремления: довыдано ${granted} носителей Механики задним числом.`);
  return granted;
}

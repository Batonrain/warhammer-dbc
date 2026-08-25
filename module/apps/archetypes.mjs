// module/apps/archetypes.mjs
// ════════════════════════════════════════════════════════════════════════
//  Архетипы Мастера создания: библиотека-компендиум вместо констант.
//  И Мастер, и новый селектор «Архетип» в шапке листа читают компендиум —
//  ГМ может завести свой Архетип прямо в библиотеке, и он появится в списках
//  (тот же приём, что у Родных миров/Предсказаний/Стремлений).
//
//  В отличие от них у Архетипа богатая вложенная структура (charBonus —
//  объект характеристик, trait — {name,benefit}), которая не ложится в
//  плоский индекс origin-shared.mjs (там кэш — по нескольким системным
//  полям через pack.getIndex). Поэтому здесь свой кэш ПОЛНЫХ документов
//  (pack.getDocuments() — библиотека небольшая, ~40 записей).
// ════════════════════════════════════════════════════════════════════════

import { ARCHETYPES } from "../constants/archetypes.mjs";
import { isAeldariRace } from "./race-library.mjs";
import { clearGrantedBy } from "./origin-shared.mjs";
import { SKIP_MECHANICS_HOOK } from "./races.mjs";
import { applyItemMechanics } from "./mechanics.mjs";
import { MECHANICUS_IMPLANTS, SKITARII_WAR_PLATE } from "../constants/implants.mjs";

const PACK = "warhammer-dbc.archetypes";
const FLAG = "warhammer-dbc";
const GRANT = "originGrant";
const TAG   = "archetype";

let CACHE = null;   // { key: def, ... } — тот же формат, что раньше был у ARCHETYPES

function docToDef(doc) {
  const s = doc.system || {};
  const hasTrait = !!(s.trait?.name || s.trait?.benefit);
  return {
    name: doc.name, race: s.race || "", group: s.group || "",
    charBonus: { ...(s.charBonus || {}) }, charChoice: s.charChoice || "",
    skills: s.skills || "", talents: s.talents || "", gear: s.gear || "",
    wounds: s.wounds || "", infRoll: s.infRoll || "", requiredPath: s.requiredPath || "",
    isPsyker: !!s.isPsyker, isTechpriest: !!s.isTechpriest, psykerClass: s.psykerClass || "",
    grantsWarPlate: !!s.grantsWarPlate, grantsImplants: !!s.grantsImplants,
    desc: s.description || "",
    trait: hasTrait ? { name: s.trait.name || "", benefit: s.trait.benefit || "" } : null
  };
}

/** Перечитать компендиум в кэш; пока он не наполнен — константы как есть (fallback). */
export async function refreshArchetypeCache() {
  try {
    const pack = game.packs.get(PACK);
    if (!pack) return;
    const docs = await pack.getDocuments();
    if (!docs.length) return;
    const out = {};
    for (const d of docs) out[d.system?.key || d.id] = docToDef(d);
    CACHE = out;
  } catch (e) { console.warn("Warhammer DBC | Кэш архетипов:", e); }
}

/** { key: def } — источник для всего, что раньше читало ARCHETYPES напрямую. */
export function archetypeEntries() { return CACHE || ARCHETYPES; }

// Друкхарийские архетипы по субрасе (Книга Аэльдари: Ответвления, таблица
// доступа). Недорождённый — базовая раса без выбранной субрасы: всё, кроме
// Придворного (он только у Истиннорождённого). Ключи — system.key записей
// компендиума archetypes/Друкхари.
const DRUKHARI_BASE = ["drFreebooter", "drAssassin", "drOutcast", "drDuelist", "drPitFighter", "drAlchemist", "drKabalite"];
const DRUKHARI_SUBRACE_ARCHETYPES = {
  "":                 DRUKHARI_BASE,                                                          // Недорождённый
  truebornDrukhari:   [...DRUKHARI_BASE, "drCourtier"],                                        // Истиннорождённый
  mandrake:           ["drAssassin", "drOutcast", "drPitFighter"],                              // Мандрагора
  wrack:              ["drFreebooter", "drAssassin", "drAlchemist", "drOutcast", "drPitFighter", "drKabalite"] // Развалина
};
// Сслит — не эльдар (races/Другие_Ксеносы), своих архетипов не имеет: таблица
// даёт доступ к части архетипов Друкхари напрямую, теми же записями компендиума.
const SSLYTH_ARCHETYPES = ["drFreebooter", "drDuelist", "drAssassin", "drOutcast", "drPitFighter"];

/**
 * Записи архетипов, доступные выбранной расе — та же фильтрация, что у Мастера создания.
 * @param {string} raceKey
 * @param {{subrace?: string, pastRace?: string}} [opts]
 *   subrace  — для Друкхари: сужает список (Мандрагора/Развалина/Истиннорождённый).
 *   pastRace — для Иннари: раса, чей архетип наследуется (actor.system.ynnariPast).
 */
export function archetypesForRace(raceKey, opts = {}) {
  const { subrace = "", pastRace = "" } = opts;
  const all = Object.entries(archetypeEntries());
  const byRace = r => all.filter(([, a]) => a.race === r);
  const human = () => all.filter(([, a]) => !["astartes", "azuriane", "drukhari", "harlequin"].includes(a.race));

  if (raceKey === "astartes")  return byRace("astartes");
  if (raceKey === "azuriane")  return byRace("azuriane");
  if (raceKey === "harlequin") return byRace("harlequin");
  if (raceKey === "drukhari") {
    const keys = DRUKHARI_SUBRACE_ARCHETYPES[subrace] || DRUKHARI_BASE;
    return byRace("drukhari").filter(([k]) => keys.includes(k));
  }
  if (raceKey === "sslyth") return byRace("drukhari").filter(([k]) => SSLYTH_ARCHETYPES.includes(k));
  if (raceKey === "human")  return human();
  // Иннари: своих архетипов нет — «выберите любую прошлую расу и архетип».
  if (raceKey === "ynnari") return pastRace ? archetypesForRace(pastRace) : [];
  // Полуэльдар: любой архетип людей, Азуриани или Друкхари (на договоре с ГМ).
  if (raceKey === "halfEldar") return [...human(), ...byRace("azuriane"), ...byRace("drukhari")];
  // Прочие Аэльдари (Экзодиты) используют Пути — архетипов в паке пока нет
  // (см. [WIP]-заготовки); всё не-эльдарское прочее — человеческие архетипы.
  if (!isAeldariRace(raceKey)) return human();
  return [];
}

/** Данные селектора «Архетип» для шапки листа: группы (по .group) + текущий выбор. */
export function archetypeSheetContext(actor) {
  const raceKey = actor.system.race || "human";
  const entries = archetypesForRace(raceKey, {
    subrace: actor.system.subrace || "",
    pastRace: actor.system.ynnariPast || ""
  });
  const rawCur = actor.system.archetype || "";
  // Обратная совместимость: раньше поле хранило ИМЯ архетипа (текст), не ключ.
  const byKey  = entries.find(([k]) => k === rawCur);
  const byName = !byKey ? entries.find(([, a]) => a.name === rawCur) : null;
  const cur = byKey ? rawCur : (byName ? byName[0] : "");
  const grouped = {};
  for (const [k, a] of entries) (grouped[a.group || ""] ??= []).push({ key: k, name: a.name, selected: k === cur });
  return { groups: Object.entries(grouped).map(([g, opts]) => ({ label: g, opts })) };
}

Hooks.once("ready", () => refreshArchetypeCache());
for (const h of ["createItem", "deleteItem", "updateItem"])
  Hooks.on(h, (doc) => { if (doc?.pack === PACK) refreshArchetypeCache(); });

// ── Выбор Архетипа в шапке листа: выдача через Механику ─────────────────────
// Раньше select «Архетип» просто писал ключ в system.archetype и всё — сам
// предмет-архетип на актора не попадал, поэтому его вкладка МЕХАНИКА (Черты/
// Таланты/Характеристики/Снаряжение/...) никогда не читалась: applyItemMechanics
// вызывается только из хука createItem, а он для строкового поля не срабатывает.
// Теперь при выборе на актора кладётся embedded-копия архетипа СО ВСЕЙ его
// текущей Механикой (тем, что ГМ настроил на вкладке МЕХАНИКА самой записи
// компендиума) — тот же приём «предмет-носитель», что у Родных миров
// (grantHomeworld в module/apps/homeworlds.mjs), но без пересборки charBonuses
// из констант: здесь переносится ИМЕННО flags.mechanics компендиумной записи
// как есть, включая любые ручные правки ГМа.

/** Embedded-копия архетипа на акторе (выданная через applyArchetype), или null. */
export function actorArchetypeItem(actor) {
  return actor?.items?.find(i => i.type === "archetype" && i.getFlag(FLAG, GRANT) === TAG) || null;
}

/** Снимает текущий архетип и всё, что он выдал через Механику. */
export async function clearArchetype(actor) {
  await clearGrantedBy(actor, TAG, actorArchetypeItem(actor));
}

/**
 * Импланты Механикум / Боевые Латы Скитарии — та же выдача, что у Мастера
 * создания (apps/creation.mjs::grantMechanicusImplants/grantSkitariiWarPlate),
 * продублирована здесь мелкой копией, а не импортом: creation.mjs сам
 * импортирует applyArchetype из этого файла, обратный импорт дал бы цикл.
 * Идемпотентно — сверяет по имени уже стоящие Импланты, повторный вызов
 * (смена архетипа туда-обратно) не задвоит выдачу.
 */
async function grantArchetypeImplants(actor, { grantsImplants, grantsWarPlate }) {
  if (!grantsImplants && !grantsWarPlate) return;
  const existing = new Set(actor.items.filter(i => i.type === "implant").map(i => i.name));
  if (grantsImplants) {
    const toAdd = MECHANICUS_IMPLANTS.filter(d => !existing.has(d.name)).map(d => foundry.utils.deepClone(d));
    if (toAdd.length) await actor.createEmbeddedDocuments("Item", toAdd);
  } else if (grantsWarPlate && !existing.has(SKITARII_WAR_PLATE.name)) {
    await actor.createEmbeddedDocuments("Item", [foundry.utils.deepClone(SKITARII_WAR_PLATE)]);
  }
}

/**
 * Выбор архетипа: снимает прежний, кладёт embedded-копию выбранного,
 * обновляет system.archetype (селектор в шапке читает именно его, см.
 * archetypeSheetContext).
 *
 * Механику носителя применяем СИНХРОННО (SKIP_MECHANICS_HOOK + прямой вызов
 * applyItemMechanics), а не ждём асинхронный хук createItem — тот же приём,
 * что у applyRace (module/apps/races.mjs). Без этого вызывающий код (в т.ч.
 * Мастер создания) не может дождаться результата: диалоги ИЛИ-выбора и
 * бюджетный Обозреватель компендиумов (kind:"equipment") всплывали бы уже
 * ПОСЛЕ того, как applyArchetype «завершился».
 *
 * isPsyker/isTechpriest/psykerClass/grantsImplants/grantsWarPlate раньше
 * применял только Мастер создания (одноразовым чтением сырых полей архетипа,
 * apps/creation.mjs) — при смене архетипа этим же селектором позже статус
 * псайкера/техножреца и импланты никогда не выставлялись. charBonus и
 * сигнатурная Черта архетипа сюда не входят — они уже переехали в саму
 * Механику носителя (flags.mechanics, kind:"characteristic"/"trait") и
 * применяются как часть applyItemMechanics выше.
 * @param {Actor} actor
 * @param {string} key   ключ/uuid-хвост записи компендиума (см. docToDef) или ""
 */
export async function applyArchetype(actor, key) {
  if (!actor) return;
  await clearArchetype(actor);
  if (!key) { await actor.update({ "system.archetype": "" }); return; }

  const pack = game.packs.get(PACK);
  const docs = pack ? await pack.getDocuments() : [];
  const src  = docs.find(d => (d.system?.key || d.id) === key) || null;
  if (!src) { await actor.update({ "system.archetype": key }); return; }

  const data = src.toObject();
  delete data._id;
  data.flags = { ...(data.flags || {}), [FLAG]: { ...(data.flags?.[FLAG] || {}), [GRANT]: TAG } };
  const [created] = await actor.createEmbeddedDocuments("Item", [data], { [SKIP_MECHANICS_HOOK]: true });
  if (created) await applyItemMechanics(created);

  const s = src.system ?? {};
  const upd = { "system.archetype": key };
  if (s.isPsyker) upd["system.isPsyker"] = true;
  if (s.isTechpriest) upd["system.isTechpriest"] = true;
  if (s.psykerClass) upd["system.psyker.class"] = s.psykerClass;
  await actor.update(upd);
  await grantArchetypeImplants(actor, s);
}

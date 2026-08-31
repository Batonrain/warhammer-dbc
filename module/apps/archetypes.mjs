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
import { MECHANICUS_IMPLANTS, SKITARII_WAR_PLATE, MECHANICUM_IMPLANTS_TRAIT } from "../constants/implants.mjs";
import { loadPackDocuments, registerPackCacheRefresh } from "./pack-doc-cache.mjs";

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
    trait: hasTrait ? { name: s.trait.name || "", benefit: s.trait.benefit || "" } : null,
    // Таблица доступа Друкхари/Сслит (wdbc-t9ei) — значимо только у race:"drukhari".
    drukhariSubraces: Array.isArray(s.drukhariSubraces) ? s.drukhariSubraces : [],
    sslythAccess: !!s.sslythAccess
  };
}

/** Перечитать компендиум в кэш; пока он не наполнен — константы как есть (fallback). */
export async function refreshArchetypeCache() {
  const docs = await loadPackDocuments(PACK, "Кэш архетипов");
  if (!docs || !docs.length) return;
  const out = {};
  for (const d of docs) out[d.system?.key || d.id] = docToDef(d);
  CACHE = out;
}

/** { key: def } — источник для всего, что раньше читало ARCHETYPES напрямую. */
export function archetypeEntries() { return CACHE || ARCHETYPES; }

// Друкхарийские архетипы по субрасе (Книга Аэльдари: Ответвления, таблица
// доступа) — данные лежат ПРЯМО НА ЗАПИСИ архетипа (drukhariSubraces/
// sslythAccess, module/data/item/archetype.mjs, wdbc-t9ei): каждая запись
// компендиума archetypes/Друкхари сама знает, каким субрасам и Сслит она
// доступна, а не наоборот — код больше не держит отдельные списки ключей.
// Известные значения субрасы Друкхари; неизвестное/пустое — как у
// Недорождённого (тот же фоллбэк, что раньше давал `|| DRUKHARI_BASE`).
const KNOWN_DRUKHARI_SUBRACES = ["", "truebornDrukhari", "mandrake", "wrack"];

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
    const key = KNOWN_DRUKHARI_SUBRACES.includes(subrace) ? subrace : "";
    return byRace("drukhari").filter(([, a]) => (a.drukhariSubraces || []).includes(key));
  }
  if (raceKey === "sslyth") return byRace("drukhari").filter(([, a]) => !!a.sslythAccess);
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
  let byKey  = entries.find(([k]) => k === rawCur);
  let byName = !byKey ? entries.find(([, a]) => a.name === rawCur) : null;
  // Уже выбранный архетип удерживается, даже если текущий фильтр доступа
  // (субраса/вайтлист, чужая запись компендиума) его больше не отдаёт: иначе
  // селектор пустеет и пересохранение шапки пишет "" поверх system.archetype.
  if (rawCur && !byKey && !byName) {
    const all = Object.entries(archetypeEntries());
    const held = all.find(([k]) => k === rawCur) || all.find(([, a]) => a.name === rawCur);
    if (held) { entries.push(held); byKey = held[0] === rawCur ? held : null; byName = byKey ? null : held; }
  }
  const cur = byKey ? rawCur : (byName ? byName[0] : "");
  const grouped = {};
  for (const [k, a] of entries) (grouped[a.group || ""] ??= []).push({ key: k, name: a.name, selected: k === cur });
  return { groups: Object.entries(grouped).map(([g, opts]) => ({ label: g, opts })) };
}

registerPackCacheRefresh(PACK, refreshArchetypeCache);

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
    // Без этой Черты требование "Трейт Mechanicum Implants" у Элитных
    // архетипов Механикус (Архимагос, Секутор и т.д.) не проходит, хотя
    // физические импланты выше уже выданы — см. grantMechanicumImplantsTrait
    // в apps/creation.mjs (та же логика, продублирована по тем же причинам).
    const hasTrait = actor.items.some(i => i.type === "trait" && i.name === MECHANICUM_IMPLANTS_TRAIT.name);
    if (!hasTrait) toAdd.push(foundry.utils.deepClone(MECHANICUM_IMPLANTS_TRAIT));
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

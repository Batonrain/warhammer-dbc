// module/apps/race-library.mjs
// ════════════════════════════════════════════════════════════════════════
//  Расы и субрасы из компендиума — источник для всего, что раньше читало
//  константу RACES. Приём тот же, что у Архетипов (apps/archetypes.mjs): свой
//  кэш ПОЛНЫХ документов, потому что плоский индекс origin-shared.mjs не
//  вмещает вложенные chars и записи Конструктора.
//
//  Пока пак не прочитан — отдаются константы. Так лист и Мастер создания
//  работают и до готовности мира, и в тестах вне Foundry.
//
//  Здесь только ЧТЕНИЕ. Применение расы к актору — apps/races.mjs.
// ════════════════════════════════════════════════════════════════════════

import { RACES, SUBRACES, SUBRACE_DATA, RACE_GROUPS } from "../constants/races.mjs";

const PACK = "warhammer-dbc.races";
const AELDARI_GROUP = "Аэльдари";

let RACE_CACHE = null;      // { key: RaceDef }
let SUB_CACHE  = null;      // { key: SubraceDef }

/** Группа расы по константам — резерв, пока пак не прочитан. */
const constGroup = key => RACE_GROUPS.find(g => g.races.includes(key))?.label || "";

/**
 * Единое правило ключа расы/субрасы: `system.key`, а если поле не заполнено —
 * идентификатор документа. Тем же правилом читает кэш (ниже) — и им же обязан
 * пользоваться КАЖДЫЙ потребитель, который вычисляет ключ у документа расы САМ
 * (дроп на лист, страховочный хук createItem), а не берёт готовый из кэша.
 * Раньше дроп на лист брал ключ отдельно (`system.key || ""`) и падал в пустую
 * строку — а пустая строка на пути применения означает «снять расу», поэтому
 * раса без заполненного `system.key` через дроп молча стирала персонажа
 * (Находка C1 общего ревью, wdbc-n1k): в кэше та же запись индексируется под
 * `doc.id` и через пикер работала нормально.
 */
export function raceKeyOf(doc) { return doc?.system?.key || doc?.id || ""; }

const raceFromDoc = doc => ({
  key: raceKeyOf(doc), label: doc.name,
  group: doc.system?.group || "",
  chars: { ...(doc.system?.chars || {}) },
  bonusRolls: doc.system?.bonusRolls || 0,
  skills: doc.system?.skills || "", gear: doc.system?.gear || "",
  talents: doc.system?.talents || "", desc: doc.system?.description || "",
  hasGeneSeed: !!doc.system?.hasGeneSeed,
  pastRaces: [...(doc.system?.pastRaces || [])],
  uuid: doc.uuid
});

const raceFromConst = (key, r) => ({
  key, label: r.label, group: constGroup(key),
  chars: { ...(r.chars || {}) }, bonusRolls: r.bonusRolls || 0,
  skills: r.skills || "", gear: r.gear || "",
  talents: Array.isArray(r.talents) ? r.talents.join(", ") : (r.talents || ""),
  desc: r.desc || "", hasGeneSeed: !!r.hasGeneSeed,
  pastRaces: [...(r.pastRaces || [])], uuid: ""
});

const subFromDoc = doc => ({
  key: raceKeyOf(doc), label: doc.name,
  parent: doc.system?.parentKey || "", cost: doc.system?.cost || 0,
  effect: doc.system?.effect || "", god: doc.system?.god || "",
  charMods: { ...(doc.system?.charMods || {}) },
  talents: doc.system?.talents || "",
  removesTraits: [...(doc.system?.removesTraits || [])],
  uuid: doc.uuid
});

const subFromConst = (key, label) => {
  const s = SUBRACE_DATA[key] || {};
  return {
    key, label,
    parent: Object.entries(RACES).find(([, r]) => (r.subraces || []).includes(key))?.[0] || "",
    cost: s.cost || 0, effect: s.effect || "", god: s.god || "",
    charMods: { ...(s.charMods || {}) },
    talents: Array.isArray(s.talents) ? s.talents.join(", ") : (s.talents || ""),
    removesTraits: [...(s.removesTraits || [])], uuid: ""
  };
};

/** Перечитать компендиум. Пустой или отсутствующий пак кэш не портит. */
export async function refreshRaceCache() {
  try {
    const pack = game.packs.get(PACK);
    if (!pack) return;
    const docs = await pack.getDocuments();
    if (!docs.length) return;
    const races = {}, subs = {};
    for (const d of docs) {
      if (d.type === "race")    races[d.system?.key || d.id] = raceFromDoc(d);
      if (d.type === "subrace") subs[d.system?.key || d.id]  = subFromDoc(d);
    }
    // Половины ставятся порознь и только непустые. Пустая половина — это не
    // «в книге столько и есть», а «прочитать не удалось»: пак прочитан
    // частично, пересобран под живым сервером, миграция сменила тип документа.
    // Раньше такая половина молча вставала на место рабочего отката, и субрасы
    // пропадали разом у ВСЕХ рас (пак с расами, но без субрас — ровно этот
    // случай). Откат на константы хуже свежих данных, но лучше пустоты.
    if (Object.keys(races).length) RACE_CACHE = races;
    if (Object.keys(subs).length)  SUB_CACHE  = subs;
  } catch (e) { console.warn("Warhammer DBC | Кэш рас:", e); }
}

/** { key: RaceDef } — то, что раньше читали прямо из RACES. */
export function raceEntries() {
  if (RACE_CACHE) return RACE_CACHE;
  return Object.fromEntries(Object.entries(RACES).map(([k, r]) => [k, raceFromConst(k, r)]));
}

export function subraceEntries() {
  if (SUB_CACHE) return SUB_CACHE;
  return Object.fromEntries(Object.entries(SUBRACES).map(([k, l]) => [k, subFromConst(k, l)]));
}

export function raceDef(key) { return raceEntries()[key] || null; }

/** Субрасы расы: отбор по родителю, а не по списку внутри расы. */
export function subracesOf(raceKey) {
  if (!raceKey) return [];
  return Object.values(subraceEntries())
    .filter(s => s.parent === raceKey)
    .map(s => ({ key: s.key, label: s.label }));
}

/** Аэльдари — это группа, а не отдельный список: набор рас совпадает. */
export function isAeldariRace(key) { return raceDef(key)?.group === AELDARI_GROUP; }

/** Расы по группам, в порядке книги — для optgroup в списках. */
export function raceGroupList() {
  const all = Object.values(raceEntries());
  const order = RACE_GROUPS.map(g => g.label);
  const seen = [...new Set(all.map(r => r.group).filter(Boolean))]
    .sort((a, b) => order.indexOf(a) - order.indexOf(b));
  return seen.map(label => ({
    label, races: all.filter(r => r.group === label).map(r => ({ key: r.key, label: r.label }))
  }));
}

Hooks.once("ready", () => refreshRaceCache());
for (const h of ["createItem", "deleteItem", "updateItem"])
  Hooks.on(h, (doc) => { if (doc?.pack === PACK) refreshRaceCache(); });

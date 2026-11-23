// module/rules/twin-spirit.mjs
// ════════════════════════════════════════════════════════════════════════
//  Лист демона Двойного Духа (корбук, «Одержимый», стр. 129-132) — чистая
//  часть. Демон внутри Одержимого — обычный Актор типа «daemon» (копия из
//  Бестиария, apps/twin-spirit.mjs), ссылка на него лежит у хоста в
//  system.possession.demonUuid. Отсюда берутся числа, которых у хоста нет:
//  WS/BS/W/Inf демона, его пси-профиль, Навыки и Таланты, Локус.
//
//  Без связанного листа всё здесь отвечает «нет данных» (null/0) — Таланты и
//  Дары тогда ведут себя как раньше (заметка, ручной счёт), ничего не ломая.
//
//  Модуль НЕ источник правил и в sources.mjs не входит: импортируют его
//  листы, карточки и бой — круг через collect.mjs ему не грозит.
// ════════════════════════════════════════════════════════════════════════

import { canManifestPossession, itemHasName } from "./predicates.mjs";
import { findGroupEntry } from "../constants/skill-specializations.mjs";
import { SKILL_RANKS } from "../constants/characteristics.mjs";

/** Метка на Акторе-демоне: uuid его хоста (кто в ком живёт). */
export const TWIN_HOST_FLAG = "twinSpiritHost";

/** Бестиарные имена демонов Двойного Духа (ключ constants/possession.mjs → запись Бестиария). */
export const TWIN_BESTIARY_NAMES = Object.freeze({
  katart: "Катарт", demonette: "Демонетка", plaguebearer: "Чумонос",
  bloodletter: "Кровопускатель", pinkhorror: "Розовый Ужас"
});

const defaultResolve = uuid => globalThis.fromUuidSync?.(uuid) ?? null;
const num = v => Number(v) || 0;
const charTotal = (a, k) => num(a?.system?.characteristics?.[k]?.total);
const charBonus = (a, k) => {
  const b = a?.system?.characteristics?.[k]?.bonus;
  return Number.isFinite(Number(b)) && b !== null && b !== "" ? Number(b) : Math.floor(charTotal(a, k) / 10);
};
const hasTalent = (actor, name) => [...(actor?.items ?? [])].some(i => i?.type === "talent" && itemHasName(i, name));
/** Одержимый в Проявлении — Дары («… / Дар: X») действуют только так. */
const inManifestation = host => canManifestPossession(host) && !!host?.system?.possession?.manifested;

/** uuid связанного листа демона ("" — листа нет). */
export const twinDemonUuid = host => String(host?.system?.possession?.demonUuid ?? "").trim();

/** Актор-демон хоста или null (лист не создан / удалён). */
export function twinDemonOf(host, resolve = defaultResolve) {
  const uuid = twinDemonUuid(host);
  if (!uuid) return null;
  try { return resolve(uuid) ?? null; } catch { return null; }
}

/** Числа демона для листа хоста; null — демона нет. */
export function twinDemonStats(demon) {
  if (!demon) return null;
  const w = demon.system?.wounds ?? {};
  return {
    name: demon.name ?? "", uuid: demon.uuid ?? "",
    ws: charTotal(demon, "ws"), bs: charTotal(demon, "bs"),
    wp: charTotal(demon, "wp"), wpBonus: charBonus(demon, "wp"),
    inf: charTotal(demon, "inf"), infBonus: charBonus(demon, "inf"),
    psyRating: num(demon.system?.psyker?.rating),
    wounds: { value: num(w.value), max: num(w.max) },
    rank: String(demon.system?.rank ?? "lesser")
  };
}

/**
 * Время контроля демона (Twin Spirit): 10 − W.b хоста часов (мин. 1); «или
 * неограниченное время, если W демона выше». W хоста — с надбавкой Симбиоза
 * (+5 за пункт «в расчёте … макс. времени контроля»).
 * @returns {{hours:number, unlimited:boolean}}
 */
export function controlTime(hostW, demonW = null) {
  const hours = Math.max(1, 10 - Math.floor(num(hostW) / 10));
  return { hours, unlimited: demonW != null && num(demonW) > num(hostW) };
}

// ── Общая Бойня (Shared Slaughter) ─────────────────────────────────────────

export const SHARED_SLAUGHTER_TURN_FLAG = "sharedSlaughterReroll";

/**
 * Предел переброса Общей Бойни: «используя для этого меньший WS или BS из
 * обоих». Исходный Предел уже содержит Характеристику хоста — снимаем
 * разницу, если демонская ниже; выше — Предел прежний (меньшая — хоста).
 * @returns {{threshold:number, lower:number, hostChar:number, demonChar:number}|null}
 */
export function sharedSlaughterThreshold(threshold, charKey, host, demon) {
  if (charKey !== "ws" && charKey !== "bs") return null;
  if (!demon) return null;
  const hostChar = charTotal(host, charKey), demonChar = charTotal(demon, charKey);
  return { threshold: num(threshold) - Math.max(0, hostChar - demonChar),
    lower: Math.min(hostChar, demonChar), hostChar, demonChar };
}

/** Предлагать ли переброс Общей Бойни на карточке атаки. */
export function sharedSlaughterOffered(host, { charKey, rv, threshold, rerolled = false, turnAvailable = true, demon = null } = {}) {
  if (rerolled || !turnAvailable || !demon) return false;
  if (charKey !== "ws" && charKey !== "bs") return false;
  if (!(num(rv) > num(threshold))) return false;
  if (!host?.system?.possession?.manifested) return false;
  return hasTalent(host, "Shared Slaughter");
}

// ── Аура Хаоса (Дар) ──────────────────────────────────────────────────────

/** Флаг предмета-щита Ауры Хаоса. */
export const AURA_OF_CHAOS_FLAG = "auraOfChaosShield";

/** Рейтинг сквозного щита «1-W демона»; 0 — щита нет (не Проявлен, нет Дара или листа демона). */
export function auraOfChaosRating(host, demon) {
  if (!demon || !(inManifestation(host) && hasTalent(host, "Дар: Аура Хаоса"))) return 0;
  return charTotal(demon, "wp");
}

/** «На любом дубле при успешном броске на щит он вызывает Феномен»: 11, 22 … 99. */
export function auraOfChaosPhenomenon(rv, blocked) {
  const n = num(rv);
  return !!blocked && n >= 11 && n <= 99 && n % 11 === 0;
}

// ── Интроспекция ──────────────────────────────────────────────────────────

export const INTROSPECTION_TURN_FLAG = "introspection";

/** Бонус Навыка Forbidden Lore (Daemons) — по рангу (Знает +0 … Ветеран +30); нет Навыка — 0. */
export function introspectionBonus(host) {
  if (!hasTalent(host, "Introspection")) return 0;
  const e = findGroupEntry(host, "forbiddenLore", "Daemons");
  if (!e) return 0;
  return Math.max(0, SKILL_RANKS[e.rank]?.bonus ?? 0);
}

/** Пороги встречного теста Интроспекции: Charm/Logic хоста + бонус vs W демона. */
export function introspectionThresholds(host, demon, skill = "charm") {
  const key = skill === "logic" ? "logic" : "charm";
  const base = num(host?.system?.skills?.[key]?.total);
  return { skill: key, host: base + introspectionBonus(host), demon: charTotal(demon, "wp") };
}

/** Доп. Дар Интроспекции держится до повторной активации Таланта или выхода из Проявления. */
export const introspectionExtraGift = host => (host?.system?.possession?.manifested && host?.flags?.["warhammer-dbc"]?.introspectionGift) ? 1 : 0;

// ── Общее Колдовство ──────────────────────────────────────────────────────

export const SHARED_SORCERY_FLAG = "sharedSorcery";

/**
 * Можно ли неконтролирующей душе манифестировать сейчас: раз в Раунд, и не
 * раньше конца простоя после силы за полудействие (1 Раунд) / полное (3).
 * Вне боя (round == null) ограничений нет; метка другого боя (или старая без combatId) не держит.
 */
export function sharedSorceryAvailable(state, round, combatId = "") {
  if (round == null || !state) return true;
  if (!state.combatId || state.combatId !== combatId) return true;
  const r = num(round);
  if (num(state.round) === r) return false;
  return r > num(state.lockUntil);
}

/** Метка после манифестации: по цене силы в действиях; combatId — чтобы простой не переживал бой. */
export function sharedSorceryMark(action, round, combatId = "") {
  const r = num(round);
  const lock = action === "full" ? 3 : action === "half" ? 1 : 0;
  return { round: r, lockUntil: r + lock, combatId };
}

/** Силы демона, доступные Общему Колдовству. */
export const demonPowers = demon => [...(demon?.items ?? [])].filter(i => i?.type === "psychicPower");

// ── Ментор ────────────────────────────────────────────────────────────────

export const MENTOR_GRANT_FLAG = "mentorGrant";
export const MENTOR_SKILLS_FLAG = "mentorSkills";
export const MENTOR_LIMIT = 3;

const RANK_ORDER = ["untrained", "knows", "trained", "veteran", "expert"];
const rankIdx = r => Math.max(0, RANK_ORDER.indexOf(String(r ?? "untrained")));

/**
 * Что демон может дать хосту Ментором: Таланты, которых у хоста нет, и
 * простые Навыки, где ранг демона выше. Групповые Навыки (Lore и др.) не
 * предлагаются — книга прямо запрещает демону память хоста о Lore, а
 * передачу его собственных Lore оставляем столу.
 */
export function mentorChoices(host, demon) {
  if (!demon) return { talents: [], skills: [] };
  const hostTalents = [...(host?.items ?? [])].filter(i => i?.type === "talent");
  const talents = [...(demon.items ?? [])]
    .filter(i => i?.type === "talent" && !hostTalents.some(h => itemHasName(h, String(i.name).split("/")[0].trim())))
    .map(i => ({ id: i.id, name: i.name }));
  const skills = [];
  for (const [key, s] of Object.entries(demon.system?.skills ?? {})) {
    const mine = host?.system?.skills?.[key]?.rank;
    if (rankIdx(s?.rank) > rankIdx(mine)) skills.push({ key, rank: s.rank, hostRank: mine ?? "untrained" });
  }
  return { talents, skills };
}

/**
 * План восстановления Навыков после Ментора: ранг возвращается, только если
 * он всё ещё тот, что выдан Ментором (игрок мог за это время прокачать Навык
 * сам — тогда его покупку не трогаем).
 */
export function mentorSkillRestore(host, granted) {
  const out = {};
  for (const g of granted ?? []) {
    if (!g?.key) continue;
    if (host?.system?.skills?.[g.key]?.rank === g.rank) out[`system.skills.${g.key}.rank`] = g.prevRank ?? "untrained";
  }
  return out;
}

// ── Высший Одержимый / Восходя Вместе ─────────────────────────────────────

/** Inf Герольда внутри Высшего Одержимого: ½ Inf хоста (окр.▲). */
export const greaterPossessedInf = hostInf => Math.ceil(num(hostInf) / 2);

/**
 * Обновление листа демона при возвышении. `kind`: "rising" — Возвышенный
 * (Восходя Вместе), "greater" — Герольд (Высший Одержимый). Inf ставится
 * через base: итог демона в Бестиарии хранится как base без продвижений.
 */
export function demonAscensionUpdate(kind, host, demon) {
  if (kind === "greater") {
    const inf = greaterPossessedInf(charTotal(host, "inf"));
    const adv = num(demon?.system?.characteristics?.inf?.advance) + num(demon?.system?.characteristics?.inf?.supernatural);
    return { "system.rank": "herald", "system.characteristics.inf.base": Math.max(0, inf - adv) };
  }
  return { "system.rank": "exalted" };
}

// ── Дары в Проявлении: временные Черты (Текучий, Наслоение) ────────────────

/** Флаг выданной на Проявление Черты: имя Дара-источника. */
export const MANIFEST_GRANT_FLAG = "manifestGrant";

/**
 * Черты Наслоения по демону (книга, «Наслоение»). Daemonic Presence (10/10)
 * общая для всех. Остальное — по имени с листа демона (там они лежат под
 * своими названиями) или из пака Черт (Flyer, Multiple Arms).
 */
export const STACKING_TRAITS = Object.freeze({
  katart: [{ name: "Flyer", rating: 7 }, { name: "Мост Между Мирами" }],
  demonette: [{ name: "Alluring Presence" }, { name: "В Глазах Смотрящего" }, { name: "Танцовщица Тёмного Принца" }],
  plaguebearer: [{ name: "Mockery of Life" }, { name: "Заражённые Раны" }, { name: "Стойкость" }],
  bloodletter: [{ name: "Blood for the Blood God" }, { name: "Знания Орудий Гнева" }, { name: "Жажда Крови" }, { name: "Кровопускание" }],
  pinkhorror: [{ name: "Sorcerous Barrier" }, { name: "Multiple Arms", rating: 1 }]
});

/**
 * Какие Черты положены хосту за Дары-формы прямо сейчас:
 * [{gift, name, rating?, rating2?}]. Пусто — не Проявлен.
 */
export function manifestTraitPlan(host) {
  if (!host?.system?.possession?.manifested) return [];
  const out = [];
  if (inManifestation(host) && hasTalent(host, "Дар: Текучий")) {
    out.push({ gift: "Текучий", name: "Amorphous" }, { gift: "Текучий", name: "Crawler" });
  }
  if (inManifestation(host) && hasTalent(host, "Дар: Наслоение")) {
    out.push({ gift: "Наслоение", name: "Daemonic Presence", rating: 10, rating2: 10 });
    for (const t of STACKING_TRAITS[host.system?.possession?.demon || "katart"] ?? []) out.push({ gift: "Наслоение", ...t });
  }
  return out;
}

/**
 * Сверка выданных Черт с планом: что снять (id) и что выдать (записи плана).
 * Сравнение по имени Дара + имени Черты, рейтинги не сравниваются — они
 * берутся из таблицы и не меняются за Проявление.
 */
export function manifestTraitDiff(host, plan = manifestTraitPlan(host)) {
  const have = [...(host?.items ?? [])].filter(i => i?.flags?.["warhammer-dbc"]?.[MANIFEST_GRANT_FLAG]);
  const key = (gift, name) => `${gift}|${String(name).toLowerCase()}`;
  const want = new Map(plan.map(p => [key(p.gift, p.name), p]));
  const remove = [], kept = new Set();
  for (const i of have) {
    const g = i.flags["warhammer-dbc"][MANIFEST_GRANT_FLAG];
    const k = key(g?.gift, g?.name);
    if (want.has(k) && !kept.has(k)) kept.add(k); else remove.push(i.id);
  }
  return { remove, create: plan.filter(p => !kept.has(key(p.gift, p.name))) };
}

// ── Локус Симбиоза ────────────────────────────────────────────────────────

/** Черты-Локусы на листе демона (имя «Locus of … / Локус …»). */
export const demonLoci = demon => [...(demon?.items ?? [])]
  .filter(i => i?.type === "trait" && /^(Locus of|Локус)/i.test(String(i.name ?? "").trim()));

/**
 * Радиус Локуса (Книга Хаоса, стр. 27): ½W герольда м. W — Сила Воли демона.
 */
export const locusRadius = demon => Math.max(1, Math.floor(charTotal(demon, "wp") / 2));

/** Действует ли Локус Симбиоза: Дар, Высший Одержимый, Проявление. */
export function symbioteLocusActive(host) {
  return !!host?.system?.possession?.greaterPossessed && inManifestation(host) && hasTalent(host, "Дар: Локус Симбиоза");
}

/** Цель Локуса Симбиоза — дружественный Одержимый в Проявлении. */
export const isManifestedPossessed = actor => !!actor?.system?.possessed && !!actor?.system?.possession?.manifested;

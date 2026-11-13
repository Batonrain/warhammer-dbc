// module/rules/rubric-sorcerer.mjs
// ════════════════════════════════════════════════════════════════════════
//  Колдун Рубрики (Элитный архетип Тысячи Сынов, глава 3, Sahara 1-54b9) —
//  чистая логика без Foundry. Foundry-обвязка — combat/rubric-sorcerer.mjs.
//
//  Рубрика Аримана: два броска на Варп-Прорыв (не на Феномены) — берётся
//  меньший, потому что таблица Прорывов тяжелеет к концу (как у Любимца
//  Варпа); два броска на Мутации — второй бросок попадает в тот же пул
//  выбора, что у Неделимого (sheets/tabs/mutations.mjs::mutationPool); тест
//  W−30 открывает весь пул Общих Мутаций.
//
//  Повелитель Големов: 8 душ. Голем — отдельный актор, помеченный
//  flags.warhammer-dbc.rubricGolem = { masterUuid, terminator, nexus };
//  свободных душ = 8 − число живых (не констатирована смерть) Големов
//  колдуна. Душа павшего Голема возвращается сама: разбитый доспех остаётся
//  в мире и годится для Возрождён во Прахе, но слот души не занимает.
//  Лояльность Голема всегда 30 (minionLoyalty, minion-sheet) и не меняется
//  Талантами (запись Конструктора «Лояльность» Големов обходит).
//
//  Способности опознаются по имени предмета ИЛИ по ключу записи
//  Конструктора (rules/item-marker.mjs), как в rules/khorne-berserker.mjs.
// ════════════════════════════════════════════════════════════════════════

import { itemHasName } from "./predicates.mjs";
import { itemHasKey } from "./item-marker.mjs";
import { findGroupEntry } from "../constants/skill-specializations.mjs";

export const GOLEM_FLAG = "rubricGolem";
export const GOLEM_SOULS = 8;
export const GOLEM_LOYALTY = 30;
export const GOLEM_PROFILE_NAME = "Голем Рубрики";
export const GOLEM_POSSESSION_HOURS = 9;
export const GOLEM_POSSESSION_MOD = -10;
export const SEKHMET_BONUS = 10;
export const SEKHMET_REGENERATION = 6;

export const SHIELD_FLAG = "rubricShield";
export const SHIELD_RATING = 50;

export const CHOICE_TEST_MOD = -30;
export const REBORN_TEST_MOD = -20;

export const INFERNAL_SHELLS_COUNT = 24;
export const INFERNAL_SHELLS_HOURS = 1;
export const INFERNAL_AMMO_NAME = "Tzeentchian Inferno";

export const ECHO_USAGE_FLAG = "psychicEcho";
export const ECHO_PENDING_FLAG = "psychicEchoPending";
export const STUPOR_FLAG = "rebornStupor";

const hasAbility = (actor, key, name, type) =>
  [...(actor?.items ?? [])].some(i => i?.type === type && (itemHasName(i, name) || itemHasKey(i, key)));

export const hasRubricOfAhriman = actor => hasAbility(actor, "ability.rubricOfAhriman", "Rubric of Ahriman", "trait");
export const hasGolemMaster = actor => hasAbility(actor, "ability.golemMaster", "Golem Master", "trait");
export const hasShieldOfRubric = actor => hasAbility(actor, "ability.shieldOfRubric", "Shield of Rubric", "trait");
export const hasInfernalShells = actor => hasAbility(actor, "ability.infernalShells", "Infernal Shells", "talent");
export const hasPsychicEcho = actor => hasAbility(actor, "ability.psychicEcho", "Psychic Echo", "talent");
export const hasSekhmet = actor => hasAbility(actor, "ability.sekhmet", "Sekhmet", "talent");
export const hasRebornInDust = actor => hasAbility(actor, "ability.rebornInDust", "Reborn in Dust", "talent");

/** Сколько раз взят Талант «Узы Душ» (по Голему — отдельная копия). */
export function nexusCopies(actor) {
  return [...(actor?.items ?? [])].filter(i =>
    i?.type === "talent" && (itemHasName(i, "Nexus Of Souls") || itemHasKey(i, "ability.nexusOfSouls"))).length;
}

// ── Рубрика Аримана ───────────────────────────────────────────────────────

/** Два броска на Прорыв: берётся меньший (таблица тяжелеет к концу), второй показывается. */
export function pickMilderPeril(a, b) {
  const [first, second] = [Number(a) || 0, Number(b) || 0];
  return second < first ? { keep: second, drop: first } : { keep: first, drop: second };
}

/** Порог теста W−30 (выбор мутации): W + суммарные модификаторы − 30. */
export function choiceThreshold(wp, modsTotal = 0) {
  return (Number(wp) || 0) + (Number(modsTotal) || 0) + CHOICE_TEST_MOD;
}

// ── Голем ─────────────────────────────────────────────────────────────────

const golemFlag = actor => actor?.getFlag?.("warhammer-dbc", GOLEM_FLAG) ?? actor?.flags?.["warhammer-dbc"]?.[GOLEM_FLAG] ?? null;

export const isGolem = actor => !!golemFlag(actor);
export const golemMasterUuid = actor => String(golemFlag(actor)?.masterUuid ?? "");
export const isTerminatorGolem = actor => !!golemFlag(actor)?.terminator;
export const isNexusGolem = actor => !!golemFlag(actor)?.nexus;
const isDeceased = actor => !!actor?.getFlag?.("warhammer-dbc", "deceased");

/** Големы колдуна (живые и разбитые): их Лояльность и душа ведутся отсюда. */
export function golemsOf(master, actors = []) {
  if (!master?.uuid) return [];
  return [...actors].filter(a => golemMasterUuid(a) === master.uuid);
}

/** Разбитый Голем — доспех рассыпался; душа вернулась к колдуну и свободна. */
export const golemDestroyed = actor => isDeceased(actor);

/** Сколько душ сейчас занято живыми Големами. */
export function soulsBound(master, actors = []) {
  return golemsOf(master, actors).filter(g => !golemDestroyed(g)).length;
}

/** Свободные души: 8 минус живые Големы (не меньше нуля). */
export function soulsFree(master, actors = []) {
  return Math.max(0, GOLEM_SOULS - soulsBound(master, actors));
}

/** Разбитые Големы колдуна — кандидаты для Возрождён во Прахе. */
export function fallenGolems(master, actors = []) {
  return golemsOf(master, actors).filter(golemDestroyed);
}

/** Големы, ещё не связанные Узами Душ. */
export function nexusFreeGolems(master, actors = []) {
  return golemsOf(master, actors).filter(g => !isNexusGolem(g) && !golemDestroyed(g));
}

/** Сколько Голем-связей Узов Душ ещё можно назначить: копии Таланта минус уже связанные. */
export function nexusSlotsLeft(master, actors = []) {
  const bound = golemsOf(master, actors).filter(isNexusGolem).length;
  return Math.max(0, nexusCopies(master) - bound);
}

/**
 * Свободный слот Миньона под Голема (средний Миньон-демон): слот пары
 * «Демон + Обычный» либо слот без выбранной пары (rules/minion-build.mjs::
 * slotUsage — тот же перебор). Возвращает { id } или null.
 */
export function golemSlot(freeSlots = []) {
  const exact = freeSlots.find(s => s.group === "daemon" && s.tier === "standard");
  const any = exact || freeSlots.find(s => !s.group && !s.tier);
  return any ? { id: any.talentId } : null;
}

/** Заготовка Голема-Сехмет: +10 WS и S, Раны выше на аблативные Раны брони, Regeneration 6. */
export function sekhmetStats({ ws = 0, s = 0, woundsMax = 0, ablative = 0 } = {}) {
  const abl = Math.max(0, Number(ablative) || 0);
  return {
    ws: (Number(ws) || 0) + SEKHMET_BONUS,
    s: (Number(s) || 0) + SEKHMET_BONUS,
    woundsMax: (Number(woundsMax) || 0) + abl,
    regeneration: SEKHMET_REGENERATION
  };
}

/** Сколько аблативных Ран дарит броня: запись Конструктора poolMax/ablativeWounds. */
export function armourAblative(armour) {
  const groups = armour?.flags?.["warhammer-dbc"]?.mechanics ?? armour?.getFlag?.("warhammer-dbc", "mechanics") ?? [];
  let total = 0;
  const walk = list => {
    for (const e of list ?? []) {
      if (e?.kind === "group" && e.group) walk(e.group.entries);
      else if (e?.kind === "poolMax" && e.poolTarget === "ablativeWounds") total += Number(e.value) || 0;
    }
  };
  for (const g of groups) walk(g?.entries);
  return total;
}

/** Копия брони без записи аблативных Ран: у Голема-Сехмет они уходят в Раны. */
export function armourWithoutAblative(armourData) {
  const data = JSON.parse(JSON.stringify(armourData ?? {}));
  const groups = data.flags?.["warhammer-dbc"]?.mechanics;
  if (!Array.isArray(groups)) return data;
  const strip = list => (list ?? []).filter(e => !(e?.kind === "poolMax" && e.poolTarget === "ablativeWounds"));
  for (const g of groups) g.entries = strip(g.entries);
  return data;
}

/** Рейтинг Трейта Regeneration (X) на акторе; 0 — трейта нет. Нет числа в поле — берётся из имени «… (5)». */
export function regenerationRating(actor) {
  let best = 0;
  for (const i of actor?.items ?? []) {
    if (i?.type !== "trait" || !itemHasName(i, "Regeneration")) continue;
    const fromName = Number(/\((\d+)\)\s*$/.exec(String(i.name ?? ""))?.[1]) || 0;
    best = Math.max(best, Number(i.system?.rating) || fromName);
  }
  return best;
}

/** Итог Forbidden Lore (Warp); без записи Навыка — null (тест невозможен). */
export function warpLoreTotal(actor) {
  const entry = findGroupEntry(actor, "forbiddenLore", "Warp");
  return !entry || entry.total == null ? null : Number(entry.total) || 0;
}

/** Порог вселения: For.Lore(Warp)−10; без записи Навыка — null. */
export function possessionThreshold(actor, modsTotal = 0) {
  const lore = warpLoreTotal(actor);
  return lore == null ? null : lore + GOLEM_POSSESSION_MOD + (Number(modsTotal) || 0);
}

// ── Психическое Эхо / Регенерация ─────────────────────────────────────────

/** Регенерация: восстанавливает X Ран; Эхо — удваивает. */
export function regenerationHeal(rating, { echo = false } = {}) {
  const x = Math.max(0, Number(rating) || 0);
  return echo ? x * 2 : x;
}

/** Ранен ли актор — Регенерации нечего лечить на полных Ранах. */
export function isWounded(actor) {
  const w = actor?.system?.wounds ?? {};
  const max = Number(w.effectiveMax ?? w.max) || 0;
  return (Number(w.critical) || 0) > 0 || (max > 0 && (Number(w.value) || 0) < max);
}

// ── Инфернальные Снаряды ──────────────────────────────────────────────────

/** Обычный болт: боеприпас категории bolts, подходящий болтовому оружию, не особый. */
export function isOrdinaryBolt(item) {
  const s = item?.system ?? {};
  if (item?.type !== "ammo" || s.ammoCategory !== "bolts") return false;
  if (!(Array.isArray(s.weaponTypes) && s.weaponTypes.includes("bolt"))) return false;
  const specials = (s.properties?.length ?? 0) + (s.removeProps?.length ?? 0) + (s.condMods?.length ?? 0);
  return !specials && !(Number(s.damageMod) || 0) && !(Number(s.penetrationMod) || 0)
    && !s.damageTypeOverride && !(Number(s.rarity) > 1);
}

/**
 * Единица боеприпаса в системе — полный магазин (1 единица = 24 болта болтера,
 * packs-src/ammunition/Стандартные): за час переделываются 24 болта, то есть
 * ровно одна единица. Возвращает, сколько единиц уйдёт в переделку (0 — нечего).
 */
export function shellsBatch(have) {
  return (Number(have) || 0) >= 1 ? 1 : 0;
}

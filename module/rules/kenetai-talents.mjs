// module/rules/kenetai-talents.mjs
// ════════════════════════════════════════════════════════════════════════
//  Кенетаи (Элитный архетип, «Псайкеры и оккультисты») — чистая часть.
//  Обвязка — module/combat/kenetai.mjs; окно манифестации —
//  combat/psyker-elite-hooks.mjs; форма попаданий психосилы —
//  eliteShotShape (sheets/tabs/psychic.mjs).
//
//  Оккультный Клинок: раз в Раунд после успешной рукопашной атаки
//  Психосиловым оружием — свободным действием психосила полудействия по цели
//  атаки: без Путей, одно попадание без Избегания, не в один Раунд с
//  Выжиганием Души (Путь Двух Клинков — дважды/вместе, разными оружиями).
//  Общее Сознание: до бPR союзников, в радиусе W.b м (×2 — Пространство для
//  Манёвра) каждый другой участник связи даёт +2 к тестам WS (Кенетаи — +5).
// ════════════════════════════════════════════════════════════════════════

import { itemHasName } from "./predicates.mjs";

const NS = "warhammer-dbc";
/** Оккультный Клинок в этом Раунде: { tag, weapons:[uuid] }. */
export const OCCULT_BLADE_FLAG = "occultBladeRound";
/** Выжигание Души в этом Раунде: tag. */
export const SOUL_BURN_ROUND_FLAG = "soulBurnRound";
/** Общее Сознание на Кенетаи: { members:[uuid] }. */
export const SHARED_MIND_FLAG = "sharedMind";
export const SHARED_MIND_ALLY_BONUS = 2;
export const SHARED_MIND_KENETAI_BONUS = 5;
export const FOCUSED_STORM_PEN_PER_HIT = 2;

const flagOf = (doc, key) => doc?.getFlag?.(NS, key) ?? doc?.flags?.[NS]?.[key];
const traits = actor => [...(actor?.items ?? [])].filter(i => i?.type === "trait");
const hasTalent = (actor, name) => [...(actor?.items ?? [])].some(i => i?.type === "talent" && itemHasName(i, name));
const n = v => Math.max(0, Math.trunc(Number(v) || 0));

export const hasOccultBlade = actor => traits(actor).some(i => itemHasName(i, "Occult Blade"));
export const hasSharedConsciousness = actor => traits(actor).some(i => itemHasName(i, "Shared Consciousness"));
export const hasBladesOfBrotherhood = actor => hasTalent(actor, "Blades of Brotherhood");
export const hasFocusedStorm = actor => hasTalent(actor, "Focused Storm");
export const hasSoulThrust = actor => hasTalent(actor, "Soul Thrust");
export const hasSpellBreaker = actor => hasTalent(actor, "Spell Breaker");
export const hasWayOfTwoBlades = actor => hasTalent(actor, "Way of Two Blades");
export const hasWideBerth = actor => hasTalent(actor, "Wide Berth");

/** Психосиловое (Force) рукопашное оружие. */
export function isForceMelee(weapon) {
  const s = weapon?.system ?? {};
  return weapon?.type === "weapon" && s.weaponClass === "melee" && (s.weaponProps ?? []).some(p => p?.key === "force");
}

/**
 * Можно ли Оккультный Клинок сейчас.
 * @param {{tag:string, weapons:string[]}|null} state  метка этого актора
 * @param {string} tag   метка текущего Раунда
 * @param {string} weaponUuid  оружие попадания
 * @param {{twoBlades?:boolean, soulBurnTag?:string}} o
 */
export function occultBladeAllowed(state, tag, weaponUuid, { twoBlades = false, soulBurnTag = "" } = {}) {
  const used = state?.tag === tag ? (state.weapons ?? []) : [];
  const max = twoBlades ? 2 : 1;
  if (used.length >= max) return { ok: false, reason: twoBlades ? "Оккультный Клинок уже применён дважды в этом Раунде." : "Оккультный Клинок — раз в Раунд." };
  if (used.length && weaponUuid && used.includes(weaponUuid)) return { ok: false, reason: "Путь Двух Клинков: второе применение — попаданием другого оружия." };
  if (soulBurnTag && soulBurnTag === tag && !twoBlades) return { ok: false, reason: "В этом Раунде уже было Выжигание Души." };
  return { ok: true, reason: "" };
}

/** Выжигание Души запрещено: в этом Раунде был Оккультный Клинок (без Пути Двух Клинков). */
export function soulBurnBlockedByOccultBlade(actor, tag) {
  if (hasWayOfTwoBlades(actor)) return false;
  const st = flagOf(actor, OCCULT_BLADE_FLAG);
  return !!(st && st.tag === tag && (st.weapons ?? []).length);
}

/**
 * Форма попаданий психосилы, сорвавшейся с Оккультного Клинка: одно попадание
 * по цели атаки, без шаблона. Фокусированный Шторм: Шторм/Обстрел — +2 Pen за
 * каждое несостоявшееся попадание; Взрыв — +1 Dmg за каждые 2 м радиуса;
 * Дыхание — +1 Dmg за каждые 5 м дальности.
 */
export function occultShotShape({ shootType = "", hits = 1, blast = 0, rangeM = 0, focused = false } = {}) {
  const out = { hits: 1, pen: 0, dmg: 0, noTemplate: true };
  if (!focused) return out;
  if (shootType === "storm" || shootType === "barrage") out.pen = FOCUSED_STORM_PEN_PER_HIT * Math.max(0, n(hits) - 1);
  else if (shootType === "blast") out.dmg = Math.floor(n(blast) / 2);
  else if (shootType === "breath") out.dmg = Math.floor(n(rangeM) / 5);
  return out;
}

/** Радиус Общего Сознания: W.b Кенетаи, ×2 с Пространством для Манёвра. */
export function sharedMindRange(kenetai) {
  const wb = n(kenetai?.system?.characteristics?.wp?.bonus);
  return wb * (hasWideBerth(kenetai) ? 2 : 1);
}

/** Сколько союзников можно связать: бPR. */
export function sharedMindCap(kenetai) {
  return n(kenetai?.system?.psyker?.rating);
}

/** Вклад одного связанного: +2, связанный Кенетаи (с Общим Сознанием) — +5. */
export function sharedMindAllyBonus(ally) {
  return hasSharedConsciousness(ally) ? SHARED_MIND_KENETAI_BONUS : SHARED_MIND_ALLY_BONUS;
}

/**
 * Бонус Общего Сознания к тестам WS для who: каждый другой участник связи
 * (союзники и сам Кенетаи-источник) в радиусе — +2, участник-Кенетаи (с Общим
 * Сознанием) — +5. who вне радиуса бонуса не получает. dist(a,b) → метры или
 * null (без токенов — не спорим).
 */
export function sharedMindBonus(who, kenetai, members, dist) {
  if (!who || !kenetai) return 0;
  const range = sharedMindRange(kenetai);
  const within = a => a === kenetai || (() => { const d = dist(kenetai, a); return d == null || d <= range; })();
  if (!within(who)) return 0;
  return [kenetai, ...members].filter(m => m && m !== who && m.uuid !== who.uuid && within(m))
    .reduce((s, m) => s + sharedMindAllyBonus(m), 0);
}

/** Клинки Братства: эPR клинка на оружии союзников — вдвое меньше (окр.▲). */
export function brotherhoodEpr(ePR) {
  return Math.ceil(n(ePR) / 2);
}

// ── Живой бонус к тестам WS: источник правил (rules/sources.mjs) ──────────
let _resolve = { actors: () => [], fromUuid: () => null, dist: () => null };
/** Обвязка (combat/kenetai.mjs) подставляет поиск акторов на сцене и расстояние. */
export function setSharedMindResolver(r) { _resolve = { ..._resolve, ...r }; }

/** Правила Общего Сознания для актора (пусто — нет связи). */
export function sharedConsciousnessRules(actor) {
  if (!actor) return [];
  const uuid = actor.uuid;
  let total = 0;
  for (const k of _resolve.actors()) {
    const st = flagOf(k, SHARED_MIND_FLAG);
    if (!st?.members?.length || !hasSharedConsciousness(k)) continue;
    if (k !== actor && k.uuid !== uuid && !st.members.includes(uuid)) continue;
    const members = st.members.map(u => _resolve.fromUuid(u)).filter(Boolean);
    const who = k === actor || k.uuid === uuid ? k : members.find(m => m.uuid === uuid) ?? actor;
    total += sharedMindBonus(who, k, members, _resolve.dist);
  }
  if (!total) return [];
  return [{
    id: "kenetai.sharedConsciousness", label: `Общее Сознание: +${total} к тестам WS`,
    when: {},
    effects: [{ kind: "rollBonus", target: ["weapon:melee", "basedon:ws"], value: total, auto: true, label: `Общее Сознание +${total}` }]
  }];
}

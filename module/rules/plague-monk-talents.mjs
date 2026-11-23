// module/rules/plague-monk-talents.mjs
// ════════════════════════════════════════════════════════════════════════
//  Чумной Монах — «рейтинг Unnatural T как кошелёк». Чистая арифметика;
//  кнопки и запись на актора — combat/plague-monk.mjs.
//
//  Горячечная Скорость: рейтинг Трейта Unnatural T тратится на рывки
//  (1 — Unnatural A (+2) на Раунд, 1 — +1 Реакция, 2 — безоружная атака,
//  полудвижение или яд на оружие за свободное действие); «потраченные
//  рейтинги восстанавливаются только пожиранием трупов». Пожиратель
//  Мертвечины поднимает рейтинг на 1d5 до Cor.b+2. Чревоугодие: достигнув
//  максимума, копит ещё до 2 «лишних» очков за каждую копию Таланта — они
//  тратятся, но рейтинг не поднимают.
//
//  Хранение — флаг feverT = { delta, excess } на акторе:
//    delta  — насколько текущий рейтинг отличается от Трейта на листе
//             (отрицательный — потрачено, положительный — нарастил трупами);
//             в Бонус Стойкости ложится ActiveEffect «t.bonusFx += delta»;
//    excess — «лишние» очки Чревоугодия.
//  Трейт на листе не переписывается: он — рейтинг архетипа, и сверка
//  «Обновить мир» вернула бы его к паку.
// ════════════════════════════════════════════════════════════════════════

import { hasItemNamed, itemsNamed } from "./req-atom.mjs";
import { unnaturalRating } from "./unnatural-characteristic.mjs";

export const FEVER_FLAG = "feverT";
export const FEVER_EFFECT_KEY = "feverT";

export const hasFeveredSpeed = a => hasItemNamed(a, "Fevered Speed", ["trait"]);
export const hasCarrionEater = a => hasItemNamed(a, "Carrion Eater", ["trait"]);
export const hasFeverStance = a => hasItemNamed(a, "Fever Stance", ["talent"]);
export const hasPutridClarity = a => hasItemNamed(a, "Putrid Clarity", ["talent"]);
export const hasTrueRot = a => hasItemNamed(a, "True Rot", ["talent"]);
export const hasWormListener = a => hasItemNamed(a, "Worm Listener", ["talent"]);
export const hasCorpsePoison = a => hasItemNamed(a, "Corpse Poison", ["trait"]);
/** Копий Чревоугодия («Талант можно брать до W.b раз»). */
export const gluttonyCount = a => itemsNamed(a, "Gluttony", ["talent"]).length;

/** Рывки Горячечной Скорости: цена в рейтинге Unnatural T. */
export const FEVER_OPTIONS = [
  { key: "agility",  cost: 1, label: "Unnatural A (+2) на 1 Раунд" },
  { key: "reaction", cost: 1, label: "+1 Реакция на 1 Раунд" },
  { key: "unarmed",  cost: 2, label: "Безоружная атака за свободное действие" },
  { key: "halfMove", cost: 2, label: "Полудвижение за свободное действие" },
  { key: "poison",   cost: 2, label: "Покрыть оружие трупным ядом за свободное действие" }
];

/** Сколько безоружных атак за Ход даёт Горячечная Скорость: ½ A.b (окр.▼). */
export function feverUnarmedLimit(agilityBonus) {
  return Math.floor(Math.max(0, Number(agilityBonus) || 0) / 2);
}

/** Счётчик безоружных атак Горячечной Скорости: ключ Раунда «бой:Раунд» — Раунд другого боя не считается. */
export const feverUnarmedKey = combat => (combat ? `${combat.id}:${combat.round}` : "");

/** Сколько безоружных атак уже было в этот Раунд этого боя. */
export function feverUnarmedUsed(flag, combat) {
  const key = feverUnarmedKey(combat);
  return key && flag?.key === key ? Math.max(0, Number(flag.n) || 0) : 0;
}

/** Состояние кошелька. */
export function feverState(actor) {
  const f = actor?.flags?.["warhammer-dbc"]?.[FEVER_FLAG] ?? actor?.getFlag?.("warhammer-dbc", FEVER_FLAG) ?? {};
  const base = unnaturalRating(actor, "t");
  const delta = Math.trunc(Number(f.delta) || 0);
  const current = Math.max(0, base + delta);
  const cap = (Number(actor?.system?.corruptionBonus) || 0) + 2;
  const excessCap = 2 * gluttonyCount(actor);
  const excess = Math.max(0, Math.min(excessCap, Math.trunc(Number(f.excess) || 0)));
  return { base, delta, current, cap, excess, excessCap, available: current + excess };
}

/**
 * Трата n очков: сперва «лишние» Чревоугодия, потом сам рейтинг.
 * @returns {{ok:boolean, reason?:string, delta?:number, excess?:number, fromExcess?:number}}
 */
export function feverSpendPlan(state, n) {
  const need = Math.max(1, Math.trunc(Number(n) || 1));
  if (state.available < need)
    return { ok: false, reason: `Не хватает рейтинга Unnatural T: нужно ${need}, есть ${state.available}.` };
  const fromExcess = Math.min(state.excess, need);
  const fromRating = need - fromExcess;
  return { ok: true, delta: state.delta - fromRating, excess: state.excess - fromExcess, fromExcess };
}

/**
 * Пожирание трупа: +n к рейтингу до Cor.b+2, остаток — в «лишние» Чревоугодия.
 * Рейтинг выше потолка не поднимается и не опускается.
 */
export function feverRestorePlan(state, n) {
  const add = Math.max(0, Math.trunc(Number(n) || 0));
  const room = Math.max(0, state.cap - state.current);
  const toRating = Math.min(room, add);
  const toExcess = Math.min(Math.max(0, state.excessCap - state.excess), add - toRating);
  return { delta: state.delta + toRating, excess: state.excess + toExcess, toRating, toExcess, lost: add - toRating - toExcess };
}

/** Истинная Гниль: урон трупного яда 2d10 вместо 1d10. */
export function trueRotDamage(formula) {
  return String(formula ?? "").trim() === "1d10" ? "2d10" : String(formula ?? "");
}

/** Истинная Гниль: сколько рейтинга можно влить в Rad за бой — до ½ W.b (окр.▼). */
export function trueRotRadCap(wpBonus) {
  return Math.floor(Math.max(0, Number(wpBonus) || 0) / 2);
}

/** Яд Монаха в этой атаке: безоружная/интегральная атака носителя Трупного Яда. */
export function corpsePoisonAttack(actor, unarmed) {
  return !!unarmed && hasCorpsePoison(actor);
}

/** Иммунитет к яду, который Истинная Гниль игнорирует (Daemonic, Machine, Stuff of Nightmares). */
export function trueRotBypassesImmunity(target) {
  return hasItemNamed(target, "Daemonic", ["trait"]) || hasItemNamed(target, "Machine", ["trait"])
    || hasItemNamed(target, "Stuff of Nightmares", ["trait"]);
}

// ── Слушающий Червей ───────────────────────────────────────────────────

export const WORM_POUCH_FLAG = "wormPouches";

/** Мешочков с жертвенными кусками — не больше Cor.b. */
export function wormPouchCap(actor) {
  return Math.max(0, Number(actor?.system?.corruptionBonus) || 0);
}

/** Мешочки на акторе: [{ name, tb, blessed }]. */
export function wormPouches(actor) {
  const list = actor?.flags?.["warhammer-dbc"]?.[WORM_POUCH_FLAG] ?? actor?.getFlag?.("warhammer-dbc", WORM_POUCH_FLAG);
  return Array.isArray(list) ? list : [];
}

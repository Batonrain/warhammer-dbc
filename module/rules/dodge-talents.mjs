// module/rules/dodge-talents.mjs
// ════════════════════════════════════════════════════════════════════════════
//  ТАЛАНТЫ ИЗБЕГАНИЯ (глава 3, группа «Избегание») — чистая логика.
//
//  Уже были сделаны раньше: Прилив Адреналина (combat/adrenaline-rush.mjs),
//  Трудная Цель (rules/hard-target.mjs), Щит Клинков (combat/blade-shield.mjs),
//  Сальто (+P.b к Отскоку, combat/recoil-item-bonuses.mjs), Выстрел Навскидку
//  (combat/snapshot.mjs), Шаг в Сторону (эффект предмета defenseMax +1).
//
//  Здесь — числа и условия остальных; действия, диалоги и карточки живут в
//  combat/…, чтобы это можно было проверить без Foundry.
//
//    Catfall / Кошачье Приземление — высота −A.b, +20 Группирование, ноги
//    Speed Awareness               — Избегание после Бега, −5 за P.b метров
//    Bulwark / Оплот               — Парирование щитом с Преимуществом, Баланс 1
//    Meat Shield / Живой Щит       — сектор укрытия Борьбы 180°
//    High Guard / Высокая Защитная Стойка — Вольт через Parry(WS)
//    Caution / Осторожность        — +1 Реакция за ментальное полудействие
//    Combat Master / Мастер Боя    — без бонусов за численное превосходство
// ════════════════════════════════════════════════════════════════════════════

import { hasAbility } from "./ability-by-key.mjs";

/** Короткий ключ → { ключ Возможности, имя Таланта }. */
export const DODGE_TALENTS = {
  bodyguard:      { key: "dodge.core.bodyguard",      name: "Bodyguard" },
  bladeReader:    { key: "dodge.core.bladeReader",    name: "Blade Reader" },
  bulwark:        { key: "dodge.core.bulwark",        name: "Bulwark" },
  catfall:        { key: "dodge.core.catfall",        name: "Catfall" },
  caution:        { key: "dodge.core.caution",        name: "Caution" },
  chomper:        { key: "dodge.core.chomper",        name: "Chomper" },
  combatMaster:   { key: "dodge.core.combatMaster",   name: "Combat Master" },
  counterfeint:   { key: "dodge.core.counterfeint",   name: "Counterfeint" },
  deflectShot:    { key: "dodge.core.deflectShot",    name: "Deflect Shot" },
  escapeArtist:   { key: "dodge.core.escapeArtist",   name: "Escape Artist" },
  flip:           { key: "dodge.core.flip",           name: "Flip" },
  flourishDance:  { key: "dodge.core.flourishDance",  name: "Flourish Dance" },
  highGuard:      { key: "dodge.core.highGuard",      name: "High Guard" },
  meatShield:     { key: "dodge.core.meatShield",     name: "Meat Shield" },
  pirouette:      { key: "dodge.core.pirouette",      name: "Pirouette" },
  slipAway:       { key: "dodge.core.slipAway",       name: "Slip Away" },
  speedAwareness: { key: "dodge.core.speedAwareness", name: "Speed Awareness" }
};

/** Есть ли у актора этот Талант Избегания (по имени предмета ИЛИ по ключу Возможности). */
export function hasDodgeTalent(actor, id) {
  const t = DODGE_TALENTS[id];
  return !!t && hasAbility(actor, t.key, t.name, "talent");
}

// ── Кошачье Приземление ─────────────────────────────────────────────────────

/** Бонус Группирования, +20 (книга). */
export const CATFALL_TUCK_BONUS = 20;

/** Высота падения в расчёте урона: «уменьшает на A.b», не ниже нуля. */
export function catfallHeight(height, agBonus) {
  return Math.max(0, (Number(height) || 0) - (Number(agBonus) || 0));
}

/** Нога, в которую идёт весь урон Кошачьего Приземления: 1 — левая, 2 — правая (d2, решение владельца 18.10.2026). */
export function catfallLeg(d2) {
  return Number(d2) === 1 ? "Левая нога" : "Правая нога";
}

// ── Скоростная Внимательность ───────────────────────────────────────────────

/** Штраф Избегания: −5 за каждые полные P.b метров, пробежанные в этот Ход. */
export function speedAwarenessPenalty(meters, perceptionBonus) {
  const step = Number(perceptionBonus) || 0;
  if (step <= 0) return 0;
  const full = Math.floor(Math.max(0, Number(meters) || 0) / step);
  return full > 0 ? -5 * full : 0;
}

// ── Оплот ───────────────────────────────────────────────────────────────────

/**
 * «Считает щиты имеющими Баланс 1 в расчёте других Талантов»: Баланс для
 * проверок Щита Клинков и Отбить Выстрел. Баланс самого Парирования (модификатор
 * порога) от этого не меняется.
 */
export function talentBalance(balance, { bulwark = false, isShield = false } = {}) {
  const b = Number(balance) || 0;
  return bulwark && isShield ? Math.max(b, 1) : b;
}

// ── Живой Щит ───────────────────────────────────────────────────────────────

/** Половина угла сектора укрытия Борьбы: 45° (±45°, общее правило) или 90° (180°, Живой Щит). */
export function grappleCoverHalfAngle(meatShield) {
  return meatShield ? 90 : 45;
}

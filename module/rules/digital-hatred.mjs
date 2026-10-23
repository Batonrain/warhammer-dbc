// module/rules/digital-hatred.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Digital Hatred / Цифровая Ненависть (Техномистик, DoomBC — Основная книга,
//  Sahara 3-2501): «Он уменьшает цену активации (но не Процессов) своих
//  негативно воздействующих Техночудес на 1 ⚙, если они действуют только на
//  его Ненавистных врагов.»
//
//  Три условия, и все три — из книги:
//    1. Талант «Цифровая Ненависть» (по имени или ключу Возможности
//       technomystic.core.digitalHatred);
//    2. Техночудо «негативно воздействующее» — булево поле `harmful`
//       (module/data/item/tech-power.mjs), проставленное в паке по книге;
//    3. ВСЕ цели Техночуда — Ненавистные («действуют ТОЛЬКО на»): цели Таланта
//       Hatred (rules/predicates.mjs::hatredTargetsOf), сравнение — тем же
//       anyTargetMatches, что у остальных читателей Ненависти (rules/hatred.mjs).
//       Без выбранных целей скидки нет: не из чего убедиться, что враги
//       Ненавистные, а «Все!» не делает пустой выбор Ненавистным.
//
//  Скидка трогает ТОЛЬКО цену активации (cognitionCost). Цена Процессов
//  (sustainCost) книгой исключена прямо и здесь не читается. Нижняя граница —
//  0: книга минимума не называет, но отрицательной цены Когниции не бывает.
//
//  Файл не регистрируется как источник правил (sources.mjs его не импортирует):
//  его вызывает только лист (sheets/tabs/tech.mjs) в момент активации, поэтому
//  импорт flags.mjs через ability-by-key.mjs круга не замыкает
//  (test/rules/source-registry-acyclic.test.mjs).
// ════════════════════════════════════════════════════════════════════════════

import { hatredTargetsOf, itemHasName } from "./predicates.mjs";
import { anyTargetMatches } from "./talent-targets.mjs";
import { hasAbility } from "./ability-by-key.mjs";

/** Есть ли у актора Талант «Digital Hatred / Цифровая Ненависть». */
export function hasDigitalHatred(actor) {
  return hasAbility(actor, "technomystic.core.digitalHatred", "Digital Hatred", "talent")
    || !!actor?.items?.some?.(i => i?.type === "talent" && itemHasName(i, "Цифровая Ненависть"));
}

/**
 * Скидка Цифровой Ненависти на цену активации, ⚙: 1 или 0.
 *
 * @param {object} actor       техножрец
 * @param {object} power       Техночудо (предмет или объект с `system.harmful`)
 * @param {object[]} targetActors  акторы текущих целей (токены без актора — null)
 */
export function digitalHatredDiscount(actor, power, targetActors) {
  if (power?.system?.harmful !== true) return 0;
  if (!Array.isArray(targetActors) || !targetActors.length) return 0;
  if (!hasDigitalHatred(actor)) return 0;
  const hated = hatredTargetsOf(actor);
  if (!hated.length) return 0;
  const allHated = targetActors.every(t => !!t && anyTargetMatches(hated, { targetActor: t }));
  return allHated ? 1 : 0;
}

/**
 * Цена активации Техночуда в Когниции после Цифровой Ненависти.
 *
 * @returns {{cost: number, discount: number}} `discount` — сколько реально
 *   снято (не больше базовой цены), чтобы карточка не врала «−1» при цене 0.
 */
export function techActivationCost(actor, power, targetActors) {
  const base = Number(power?.system?.cognitionCost) || 0;
  const wanted = digitalHatredDiscount(actor, power, targetActors);
  const discount = Math.min(wanted, Math.max(0, base));
  return { cost: base - discount, discount };
}

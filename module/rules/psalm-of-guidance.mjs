// module/rules/psalm-of-guidance.mjs
//
// Psalm of the Guidance / Псалом Наставления (Техночудо, Кибертеургия,
// wdbc-1rno.5, находка 8/12): «По 1/2 Когниции вместо Полудействия/Полного
// на Полу-/Полное Прицеливание оружием со свойством Cognis» — не скидка на
// ОД, а ЗАМЕНА платежа: вместо Очков Действия тратится Когниция
// (system.cognition, реальный ресурс Техножреца — sheets/tabs/tech.mjs).
// «Тип: Пассивное, Действие: Нет» — не активируется отдельно, действует
// постоянно, пока предмет у актора есть (тот же принцип, что у Талантов).
//
// «Можно совершать такие прицеливания посреди атаки с нескольких рук» —
// честный архитектурный пробел, требует per-оружие состояния Прицеливания и
// объявления действия посреди уже идущего резолва атаки, которых в системе
// нет — вынесен отдельным тикетом wdbc-1rno.32, здесь не реализовано.

import { hasAbility } from "./ability-by-key.mjs";

export const PSALM_OF_GUIDANCE_CAPABILITY = "techPower.cybertheurgy.psalmOfGuidance";

export function hasPsalmOfGuidance(actor) {
  return hasAbility(actor, PSALM_OF_GUIDANCE_CAPABILITY, "Psalm of the Guidance", "techPower");
}

/**
 * Носит ли актор экипированное оружие со свойством Cognis — прямая проверка
 * item.system.weaponProps (без merge Хвата/Мода/Боеприпаса/Правил, в отличие
 * от полного конвейера attack-dialog.mjs): приближение того же рода, что
 * actorSeesAnyTarget у Чёрных Глаз — Прицеливание объявляется в HUD ДО
 * открытия диалога атаки, где выбирается конкретное оружие/грипп/боеприпас.
 */
export function actorHasEquippedCognisWeapon(actor) {
  return !!actor?.items?.some(i =>
    i.type === "weapon" && i.system?.equipped
    && (i.system?.weaponProps || []).some(p => p.key === "cognis"));
}

/**
 * Цена Прицеливания в Когниции ВМЕСТО ОД — null, если не применимо (нет
 * Техночуда, или нет экипированного Cognis-оружия): вызывающая сторона
 * тогда платит обычным ОД (aimApCost). 1 для Полу-, 2 для Полного.
 */
export function psalmCognitionCost(actor, level) {
  if (!hasPsalmOfGuidance(actor) || !actorHasEquippedCognisWeapon(actor)) return null;
  return level === "full" ? 2 : 1;
}

/** Хватит ли Когниции на цену — «может тратить» (книга), не обязан. */
export function canSpendCognition(actor, cost) {
  return (Number(actor?.system?.cognition?.value) || 0) >= cost;
}

/** Списать Когницию. Возвращает false, если не хватило (ничего не тратит). */
export async function spendCognition(actor, cost) {
  if (!canSpendCognition(actor, cost)) return false;
  const value = Number(actor.system.cognition?.value) || 0;
  await actor.update({ "system.cognition.value": value - cost });
  return true;
}

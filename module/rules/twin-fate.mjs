// module/rules/twin-fate.mjs
// Двойная Судьба / Twin Fate (Талант Ворона): «Когда тратит Очко Бесчестия для
// переброса теста WS и результат переброса хуже, использует изначальный
// результат и восстанавливает потраченное Очко Бесчестия». Переброс атаки за
// Очко повторяет атаку целиком (hooks.mjs, меню карточки) — исходный бросок
// едет в opts.twinFate, а combat/attack.mjs сравнивает исходы этим модулем.

import { hasItemNamed } from "./req-atom.mjs";

/** Работает ли Талант на этот переброс: свой (не Чемпиона) переброс атаки от WS. */
export function twinFateApplies(actor, { charKey, champion = false } = {}) {
  return !champion && charKey === "ws" && hasItemNamed(actor, "Twin Fate", ["talent"]);
}

/**
 * Хуже ли новый исход исходного. Провал хуже Успеха; среди Успехов хуже
 * меньше Успехов, среди Провалов — больше Провалов. Равный исход не хуже —
 * остаётся переброс, Очко не возвращается.
 * @param {{success:boolean, deg:number}} orig
 * @param {{success:boolean, deg:number}} next
 */
export function twinFateWorse(orig, next) {
  if (!orig || !next) return false;
  if (!!orig.success !== !!next.success) return !!orig.success;
  const a = Number(orig.deg) || 0, b = Number(next.deg) || 0;
  return orig.success ? b < a : b > a;
}

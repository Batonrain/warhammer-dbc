// module/rules/headless.mjs
//
// Headless / Безголовый (мутация, «Общие мутации», wdbc-1rno.20): «Все
// попадания по его голове теперь приходятся в торс, но угол обзора персонажа
// ограничен 120° и он получает –2 к Инициативе» (−2 Инициативы — отдельная
// запись Конструктора на самом предмете).
//
// Обзор: combat/facing.mjs::isOutsideDefenderView берёт угол сектора из
// токена цели; у Безголового он сужается до 120° — атака вне этого сектора
// сама становится Незримой («Скрытная Атака», стр. 32). Тот же приём, что
// Янус (rules/janus.mjs), только в обратную сторону.
//
// Место попадания: «Голова», «Глаз (Голова)» и «Сочленение / Шея» → «Торс»,
// одной точкой в combat/damage.mjs::applyDamageToActor, как Бронзовый
// Мирмидон (rules/bronze-myrmidon.mjs). Шея — по решению владельца
// 26.09.2026 (wdbc-1rno.20): у Безголового её нет, метка общая с суставами
// конечностей, но переводится целиком. Карточка атаки строится раньше, чем
// выбран защищающийся, и там по-прежнему покажет «Голова» — тот же
// компромисс, что у Мирмидона.

import { itemIs } from "./item-marker.mjs";

const CAPABILITY_KEY = "mutation.headless";
const NAME = "Headless";
export const HEADLESS_SIGHT_ANGLE = 120;

/** Несёт ли актор мутацию Безголовый. */
export function isHeadless(actor) {
  return [...(actor?.items ?? [])].some(i => itemIs(i, "mutation", CAPABILITY_KEY, NAME));
}

/** Угол обзора с учётом мутации: у Безголового не шире 120°. */
export function headlessSightAngle(actor, angle) {
  if (!isHeadless(actor)) return angle;
  const n = Number(angle);
  return n > 0 && n < HEADLESS_SIGHT_ANGLE ? n : HEADLESS_SIGHT_ANGLE;
}

/** Попадание в голову Безголового — в торс. */
export function redirectHitLocationForHeadless(hitLocation, actor) {
  if (!isHeadless(actor)) return hitLocation;
  if (hitLocation === "Голова" || hitLocation === "Глаз (Голова)" || hitLocation === "Сочленение / Шея") return "Торс";
  return hitLocation;
}

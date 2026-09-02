// module/rules/vampiric-dependency.mjs
//
// Мутация «Vampiric Dependency / Вампирическая Зависимость» (Общие мутации,
// wdbc-1rno): «если персонаж воздерживается более месяца, обязан пройти тест
// на T+0 (−10 за каждый предыдущий месяц воздержания) или получить 1 Порчи».
// Тот же приём хранения состояния, что у rules/addiction.mjs — момент
// последнего утоления флагом НА ПРЕДМЕТЕ, месяц считается фиксированными 30
// сутками (книга здесь не завязана на имперский календарь — тот делит год на
// 1000 равных долей и месяцев не знает вовсе, constants/imperial-calendar.mjs).
//
// ЧТО ИМЕННО утоляет голод — 10 субмутаций текста (сердце/печень/кровь и
// т.п., у каждой свой сопутствующий бонус при утолении) — не автоматизировано
// и не будет: см. capabilities.mjs::mutation.vampiricDependency. Здесь только
// сам тест и его числовой штраф/последствие.
//
// Идентификация по имени предмета — тот же принцип, что у addiction.mjs/
// hand-of-death.mjs.

import { itemHasName } from "./predicates.mjs";
import { SECONDS_PER_DAY } from "../constants/imperial-calendar.mjs";

const NAME = "Vampiric Dependency";
const FLAG = "warhammer-dbc";
const SECONDS_PER_MONTH = 30 * SECONDS_PER_DAY;
export const VAMPIRIC_TIME_FLAG = "vampiricLastSatisfied";

/** Это предмет-Мутация «Вампирическая Зависимость»? */
export function isVampiricDependencyItem(item) {
  return item?.type === "mutation" && itemHasName(item, NAME);
}

/** Момент (worldTime) последнего утоления, или null — ещё не отмечалось. */
export function vampiricLastSatisfied(item) {
  const v = item?.getFlag?.(FLAG, VAMPIRIC_TIME_FLAG);
  return v == null ? null : Number(v);
}

/** Сколько ПОЛНЫХ месяцев (30 сут.) прошло с утоления — 0, если ещё не отмечалось. */
export function vampiricMonthsSince(item, worldTime) {
  const last = vampiricLastSatisfied(item);
  if (last == null) return 0;
  return Math.floor(Math.max(0, Number(worldTime) - last) / SECONDS_PER_MONTH);
}

/** Нужен ли тест прямо сейчас (воздержание больше месяца). */
export function vampiricTestRequired(monthsSince) {
  return monthsSince >= 1;
}

/** −10 за каждый ПРЕДЫДУЩИЙ месяц воздержания (первый просроченный месяц — без штрафа). */
export function vampiricTestPenalty(monthsSince) {
  const extraMonths = Math.max(0, monthsSince - 1);
  return extraMonths ? -10 * extraMonths : 0; // избегает -0 (Math.max(0,-1)*-10 === -0)
}

/** Кнопка «Утолить»: момент утоления → сейчас. */
export async function satisfyVampiricDependency(item) {
  if (!isVampiricDependencyItem(item)) return;
  await item.setFlag(FLAG, VAMPIRIC_TIME_FLAG, game.time?.worldTime ?? 0);
}

// module/rules/addiction.mjs
//
// Мутация «Addiction / Зависимость» (Общие мутации, wdbc-1rno): состояние
// «удовлетворена/не удовлетворена» само по игровому времени, тем же приёмом,
// что Голод/Жажда/Сон (constants/vitals.mjs::vitalNaturalStage) — момент
// последнего утоления хранится флагом НА САМОМ ПРЕДМЕТЕ (не на акторе:
// состояние принадлежит конкретной Мутации, не персонажу вообще), снимается
// только явной кнопкой «Утолить» (apps/addiction.mjs).
//
// ЧТО ИМЕННО утоляет зависимость — одна из 13 субмутаций текста (последняя
// еда, яд, кровь врага и т.п.) — не автоматизировано и не будет: это чисто
// отыгрышевый выбор игрока/ГМа (см. capabilities.mjs::mutation.addiction,
// doombc-mutations-mechanics-authoring в памяти агента). Здесь только числовой
// эффект книги: «не удовлетворив зависимость за день — штраф −10 на все тесты
// Навыков (но не тесты Характеристик), начиная со следующего дня».
//
// Идентификация по имени предмета (itemHasName), не по capabilityKey — тот же
// принцип, что у rules/hand-of-death.mjs: кнопка на листе Мутации должна
// показываться независимо от того, собрал ли движок правил её в actor.items.

import { itemHasName } from "./predicates.mjs";
import { SECONDS_PER_DAY } from "../constants/imperial-calendar.mjs";

const NAME = "Addiction";
const FLAG = "warhammer-dbc";
export const ADDICTION_TIME_FLAG = "addictionLastSatisfied";

/** Это предмет-Мутация «Зависимость»? */
export function isAddictionItem(item) {
  return item?.type === "mutation" && itemHasName(item, NAME);
}

/** Момент (worldTime) последнего утоления, или null — ещё не отмечалось. */
export function addictionLastSatisfied(item) {
  const v = item?.getFlag?.(FLAG, ADDICTION_TIME_FLAG);
  return v == null ? null : Number(v);
}

/** Сколько суток прошло с последнего утоления — 0, если ещё не отмечалось (без штрафа задним числом). */
export function addictionDaysSince(item, worldTime) {
  const last = addictionLastSatisfied(item);
  if (last == null) return 0;
  return Math.max(0, (Number(worldTime) - last) / SECONDS_PER_DAY);
}

/**
 * Штраф −10 тестам НАВЫКОВ (вызывающий сам не зовёт это из теста
 * Характеристики — см. sheets/actor-sheet.mjs::_rollSkill), начиная со
 * следующих суток после утоления. Сама находит предмет-Мутацию на акторе.
 */
export function addictionPenalty(actor, worldTime) {
  const item = [...(actor?.items ?? [])].find(isAddictionItem);
  if (!item) return 0;
  return addictionDaysSince(item, worldTime) >= 1 ? -10 : 0;
}

/** Кнопка «Утолить»: момент утоления → сейчас. */
export async function satisfyAddiction(item) {
  if (!isAddictionItem(item)) return;
  await item.setFlag(FLAG, ADDICTION_TIME_FLAG, game.time?.worldTime ?? 0);
}

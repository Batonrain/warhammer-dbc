// module/rules/fleshmetal-regen.mjs
// ════════════════════════════════════════════════════════════════════════════
//  «Укрепление Плотеметаллом» (wdbc-dnoj): металлическая плоть Облитератора
//  восстанавливает носителю +1 аблативную Рану в час и +1 аблативной
//  Ablative-брони в час, пока жив давший плоть Облитератор.
//
//  ПОТОЛОК. В тексте книги его НЕТ — рост открытый, пока действует условие.
//  Перенести это буквально нельзя: за сутки простоя набежало бы +24 и дальше
//  без конца. Решение владельца 07.09.2026: «До стартового значения» — то
//  есть регенерация доводит пул обратно до его максимума и там
//  останавливается, как обычное восстановление. Максимум уже есть в схеме
//  (system.wounds.ablativeMax и system.ablativeApShield.max), придумывать
//  новое число не понадобилось.
//
//  ТАКТ. Хранится ОДИН момент — worldTime последней выданной порции
//  (flags.warhammer-dbc.fleshmetalRegenAt), а не тикающий счётчик: тот же
//  приём, что у rules/supply-timer.mjs и rules/cooldown.mjs. Остаток
//  неполного часа не теряется — момент сдвигается ровно на выданные часы, а
//  не на «сейчас».
//
//  Пустая метка (первый раз) ничего не начисляет: иначе персонаж, у которого
//  Укрепление стоит с начала кампании, получил бы разом столько Ран, сколько
//  игровых часов прошло с сотворения мира.
//
//  Чистый модуль: ни одного обращения к Foundry, всё приходит аргументами.
// ════════════════════════════════════════════════════════════════════════════

/** Имя возможности; выдаётся Механикой предмета «Укрепление Плотеметаллом». */
export const FLESHMETAL_CAPABILITY = "armour.fleshmetalRegen";

/** Флаг с моментом последней выданной порции. */
export const FLESHMETAL_FLAG = "fleshmetalRegenAt";

/** Секунд в игровом часе. */
export const HOUR = 3600;

/**
 * Сколько целых часов прошло с последней выдачи.
 * Метки нет (null/undefined) — 0: первый проход только ставит метку.
 * Время шло назад (ГМ отмотал календарь) — тоже 0, долг не копим.
 */
export function hoursElapsed(lastAt, worldTime) {
  if (lastAt == null) return 0;
  const delta = Number(worldTime) - Number(lastAt);
  if (!Number.isFinite(delta) || delta < HOUR) return 0;
  return Math.floor(delta / HOUR);
}

/**
 * Новое значение пула после регенерации: +hours, но не выше максимума.
 * Максимум 0 или меньше — пула нет вовсе, значение не трогаем.
 */
export function regenPool(current, max, hours) {
  const cap = Number(max) || 0;
  const cur = Number(current) || 0;
  if (cap <= 0 || hours <= 0) return cur;
  return Math.min(cap, cur + hours);
}

/**
 * План регенерации для одного актора — что записать и на сколько сдвинуть
 * метку. Возвращает null, если писать нечего (это важно: хук зовётся на
 * КАЖДЫЙ тик времени у всех акторов, и лишний update на каждого — цена,
 * которую платить не за что).
 *
 * @param {object} system     actor.system
 * @param {number|null} lastAt метка последней выдачи (worldTime)
 * @param {number} worldTime  текущее игровое время
 * @returns {{update: object, flagAt: number, gained: object}|null}
 */
export function planFleshmetalRegen(system, lastAt, worldTime) {
  // Метки ещё нет — ставим её и ничего не начисляем (см. шапку).
  if (lastAt == null) return { update: {}, flagAt: Number(worldTime) || 0, gained: {} };

  const hours = hoursElapsed(lastAt, worldTime);
  if (hours <= 0) return null;

  const update = {};
  const gained = {};

  const wCur = Number(system?.wounds?.ablative) || 0;
  const wMax = Number(system?.wounds?.ablativeMax) || 0;
  const wNext = regenPool(wCur, wMax, hours);
  if (wNext !== wCur) { update["system.wounds.ablative"] = wNext; gained.wounds = wNext - wCur; }

  const aCur = Number(system?.ablativeApShield?.value) || 0;
  const aMax = Number(system?.ablativeApShield?.max) || 0;
  const aNext = regenPool(aCur, aMax, hours);
  if (aNext !== aCur) { update["system.ablativeApShield.value"] = aNext; gained.armour = aNext - aCur; }

  // Метка сдвигается на ВЫДАННЫЕ часы, а не на «сейчас»: иначе сорок минут
  // сверх часа каждый раз сгорали бы, и за сутки набежала бы потерянная Рана.
  return { update, flagAt: Number(lastAt) + hours * HOUR, gained };
}

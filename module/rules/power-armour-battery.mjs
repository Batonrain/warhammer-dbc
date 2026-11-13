// module/rules/power-armour-battery.mjs
// ═══════════════════════════════════════════════════════════════════════════
//  Батарея силовой брони (стр. 233, глава «СИЛОВАЯ БРОНЯ», wdbc-x1nz.4):
//  «Требует питания от перезаряжаемой батареи, которой хватает на 24ч
//  работы. С разряженной батареей, выключенная, или отключенная эффектом
//  Haywire броня не дает три предыдущих бонуса (бонус S, нейтрализация веса,
//  ретинальный дисплей), все ее системы выключаются, и она дает штрафы
//  выключенной силовой брони.»
//
//  Haywire сюда намеренно НЕ входит — в задаче wdbc-x1nz.4 реализована
//  только батарея (24ч + подзарядка) и время надевания/снятия; отключение
//  силовой брони полем Haywire (haywireFieldIntensity, rules/predicates.mjs)
//  этот файл не читает — отдельный, непокрытый здесь кусок книги (см. отчёт
//  сессии, который реализовал эту часть).
//
//  Тот же примитив, что у Запаса воздуха Void (module/rules/void-air.mjs,
//  module/rules/supply-timer.mjs) — момент старта таймера на флаге, остаток
//  считается по разнице с game.time.worldTime. Отличия от Void Air:
//   - фиксированные 24ч, без вариации по Качеству (книга про батарею
//     Качество не упоминает, в отличие от запаса воздуха);
//   - «Подзарядить» не просто снимает таймер (как refillVoidArmour), а сразу
//     запускает его заново с полного заряда — батарея сама не включается
//     без подзарядки, ждать «пока кто-то её включит» отдельным шагом книга
//     не описывает;
//   - разряд реально выключает систему — через ЯВНУЮ кнопку-проверку
//     (checkPowerArmourBattery), тем же полем system.active, что ручной
//     тумблер «Включена» (его уже читают rules/armour-penalty.mjs и «Вес» в
//     rules/character.mjs — второго пути штрафов не завели). Запись в
//     документ НЕ делается молча во время пересчёта листа (prepareDerivedData) —
//     во всей системе таймеры этого вида только читаются там, не пишут.
// ═══════════════════════════════════════════════════════════════════════════

import { SECONDS_PER_HOUR } from "../constants/imperial-calendar.mjs";
import { supplyRemaining, supplyStartedAt, startSupplyTimer, stopSupplyTimer } from "./supply-timer.mjs";

const FLAG = "powerArmourBatteryChargedAt";

/** Полная ёмкость батареи — часы (стр. 233): фикс 24, книга про Качество тут не говорит. */
export const POWER_ARMOUR_BATTERY_HOURS = 24;

/** Остаток заряда в секундах прямо сейчас. Не проверенная ни разу (таймер не запущен) — полный заряд. */
export function powerArmourBatteryRemainingSeconds(item) {
  return supplyRemaining(supplyStartedAt(item, FLAG), game.time.worldTime, POWER_ARMOUR_BATTERY_HOURS * SECONDS_PER_HOUR);
}

/** Батарея разряжена (0 секунд осталось). */
export function isPowerArmourBatteryDead(item) {
  return powerArmourBatteryRemainingSeconds(item) <= 0;
}

/** Подзарядить — полный заряд, таймер стартует заново с этого момента (не «не перезапускает», как у Void Air: это новая зарядка). */
export async function chargePowerArmourBattery(item) {
  await stopSupplyTimer(item, FLAG);
  await startSupplyTimer(item, FLAG);
}

/** {hours, minutes} остатка — для отображения на листе предмета. */
export function powerArmourBatteryRemainingDisplay(item) {
  const seconds = powerArmourBatteryRemainingSeconds(item);
  const hours = Math.floor(seconds / SECONDS_PER_HOUR);
  const minutes = Math.floor((seconds % SECONDS_PER_HOUR) / 60);
  return { hours, minutes };
}

/**
 * Кнопка-проверка (стр. 233): разряженная батарея выключает броню тем же
 * полем, что ручной тумблер «Включена» (system.active). Уже выключенную
 * (вручную или этим же вызовом раньше) повторно не трогает — `update` не
 * зовётся лишний раз.
 * @returns {Promise<boolean>} true — батарея разряжена (броня выключена сейчас или уже была)
 */
export async function checkPowerArmourBattery(item) {
  const dead = isPowerArmourBatteryDead(item);
  if (dead && item?.system?.active !== false) await item.update({ "system.active": false });
  return dead;
}

/**
 * Время надевания/снятия (стр. 233): ритуал — 30 мин и минимум 2 ассистента;
 * без ритуала — снятие 5 мин, надевание 15 мин (ассистенты те же двое).
 * Специализированная стойка (добывается по R1) убирает нужду в ассистентах
 * В ОБОИХ режимах, но время не меняет — поэтому отдельный параметр
 * (powerArmourAssistantsNeeded), а не третий режим.
 *
 * Первая подгонка НЕ сделанной под заказ брони (смена работы, 2 ассистента
 * со Скиллами Tech-Use и Trade (Armourer)) сюда не входит — отдельный,
 * более долгий случай, отыгрывается текстом ГМа, не числом минут на кнопке.
 */
export const POWER_ARMOUR_DRESS_MINUTES = {
  don:  { ritual: 30, fast: 15 },
  doff: { ritual: 30, fast: 5 }
};

/** Минуты на надевание («don») или снятие («doff») — ritual=true/false. */
export function powerArmourDressMinutes(action, ritual) {
  const table = POWER_ARMOUR_DRESS_MINUTES[action] ?? POWER_ARMOUR_DRESS_MINUTES.don;
  return ritual ? table.ritual : table.fast;
}

/** Нужно ли двое ассистентов — нет, если есть специализированная стойка (R1). */
export function powerArmourAssistantsNeeded(hasRack) {
  return hasRack ? 0 : 2;
}

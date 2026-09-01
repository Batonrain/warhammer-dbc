// module/rules/void-air.mjs
// ═══════════════════════════════════════════════════════════════════════════
//  Запас воздуха свойства брони Void (wdbc-jtqf, core.json стр. 228):
//  «Броня имеет собственный запас воздуха, которого хватает на 6 часов.
//  Качество брони модифицирует запас воздуха: Poor.Q: –3ч, Good.Q: +6ч,
//  Best.Q: неограниченный запас воздуха. Эффект теряется после получения
//  попадания, пробившего броню.»
//
//  Старт таймера — ЯВНАЯ кнопка на листе предмета («Загерметизировать»),
//  не автодетект «персонаж в вакууме»: система не знает, где сейчас сцена
//  (тот же принцип, что Перевес силовой брони/Транс — игровое СОБЫТИЕ решает
//  ГМ/игрок, не расчёт). system.breached уже существует и означает «пробита»
//  ЛЮБЫМ непоглощённым попаданием (breachArmorAtLocation, wdbc-k0ff,
//  combat/armor-properties.mjs) — «читатель флага решает, что означает
//  пробитие» сказано прямо в его докстринге; здесь этот читатель: пробитая
//  броня немедленно теряет запас воздуха, ЧИТАЮЩАЯ функция ничего отдельно
//  не обнуляет, remaining сам считается нулём при breached (герметичность
//  разгерметизирована, воздух улетучился, а не «утекает» плавно).
// ═══════════════════════════════════════════════════════════════════════════

import { SECONDS_PER_HOUR } from "../constants/imperial-calendar.mjs";
import { supplyRemaining, supplyStartedAt, startSupplyTimer, stopSupplyTimer } from "./supply-timer.mjs";

const FLAG = "voidAirStartedAt";

/** Итоговый запас в часах по Качеству предмета (стр. 228). Infinity — Best.Q. */
export function voidAirTotalHours(quality) {
  if (quality === "best") return Infinity;
  if (quality === "good") return 12; // 6 база + 6
  if (quality === "poor") return 3;  // 6 база − 3
  return 6;
}

/** Есть ли у предмета свойство Void (system.properties — плоский массив строковых ключей, как у остальной брони). */
export function hasVoidSupply(item) {
  return (item?.system?.properties ?? []).includes("void");
}

/**
 * Wraithbone Regeneration (wdbc-8b5, aeldari.json): «броня с этим свойством
 * не теряет свойства Sealed и Void при пробитии», пока её носит псайкер
 * (`system.isPsyker` — тот же флаг, что talent-targets.mjs::psyker.test).
 * item.parent — актор-владелец у встроенного Foundry-документа.
 */
export function wraithboneRegenIgnoresBreach(item) {
  return (item?.system?.properties ?? []).includes("wraithboneRegen") && !!item?.parent?.system?.isPsyker;
}

/**
 * Остаток запаса воздуха в секундах прямо сейчас. Пробитая броня (wdbc-k0ff)
 * теряет герметичность немедленно — 0 независимо от таймера (кроме Wraithbone
 * Regeneration в руках псайкера — см. выше). Не запущенный таймер — полный
 * запас (ничего ещё не тратилось).
 */
export function voidAirRemainingSeconds(item) {
  if (item?.system?.breached && !wraithboneRegenIgnoresBreach(item)) return 0;
  const total = voidAirTotalHours(item?.system?.quality) * SECONDS_PER_HOUR;
  return supplyRemaining(supplyStartedAt(item, FLAG), game.time.worldTime, total);
}

/** Загерметизировать (начать расход запаса) — уже запущенный/пробитый таймер не трогает. */
export async function sealVoidArmour(item) {
  if (item?.system?.breached && !wraithboneRegenIgnoresBreach(item)) return;
  await startSupplyTimer(item, FLAG);
}

/** Разгерметизировать вручную/пополнить запас (снять таймер — следующая герметизация начнёт с полного запаса). */
export async function refillVoidArmour(item) {
  await stopSupplyTimer(item, FLAG);
}

/** {hours, minutes} остатка запаса — для отображения на листе. null — безлимит. */
export function voidAirRemainingDisplay(item) {
  const seconds = voidAirRemainingSeconds(item);
  if (seconds === Infinity) return null;
  const hours = Math.floor(seconds / SECONDS_PER_HOUR);
  const minutes = Math.floor((seconds % SECONDS_PER_HOUR) / 60);
  return { hours, minutes };
}

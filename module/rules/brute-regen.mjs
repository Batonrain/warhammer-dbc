// module/rules/brute-regen.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Brute Physiology / Физиология Громилы (Огрин): «Если он легко ранен, он
//  пассивно восстанавливает 1 Рану в минуту, если тяжело ранен – 1 Рану в
//  10 минут, а если критически ранен – 1 Рану в час (Талант Hardy не
//  влияет)».
//
//  Это не режим лечения из таблицы rules/healing-clock.mjs, а отдельный,
//  собственный счётчик Черты: обычное лечение (сутки / 8 ч под уходом) идёт
//  своим чередом, это — поверх него. Hardy сюда не входит вовсе.
//
//  ТАКТ — как у rules/fleshmetal-regen.mjs: хранится ОДИН момент (worldTime,
//  с которого копится следующая Рана), а не тикающий счётчик. Каждая
//  восстановленная Рана сдвигает его ровно на свой период, и уровень ранения
//  пересматривается после каждой: критический, выбравшись из минуса,
//  дальше лечится уже как тяжёлый, а тот — как лёгкий.
//
//  Метки нет (Огрин только что ранен или часы видят его впервые) — отсчёт с
//  начала отрезка, начислять за прошлое нечего. Здоров — метка снимается:
//  следующая рана начнёт свой отсчёт заново, а не получит «накопленное» за
//  время, пока ранен не был.
//
//  Чистый модуль, без Foundry.
// ════════════════════════════════════════════════════════════════════════════

import { woundLevel } from "./wound-tier.mjs";
import { isWounded } from "./healing-clock.mjs";
import { computeWoundHealing } from "../sheets/tabs/wounds.mjs";

/** Возможность; выдаёт правило ogryn.brute.regen (rules/library/ogryn.mjs). */
export const BRUTE_REGEN_CAPABILITY = "healing.bruteRegen";

/** Флаг момента, с которого копится следующая Рана. */
export const BRUTE_REGEN_FLAG = "bruteRegenAt";

/** Период одной Раны по уровню ранения, в секундах. */
export const BRUTE_REGEN_PERIOD = { light: 60, heavy: 600, critical: 3600 };

/** Страховка от бесконечного цикла — больше Ран за раз не бывает. */
const MAX_STEPS = 1000;

/**
 * План восстановления за отрезок до `to`.
 *
 * @param {object} system  actor.system (нужны wounds и characteristics.t.bonus)
 * @param {number|null} lastAt метка (worldTime) или null
 * @param {{from:number, to:number}} span отрезок часов
 * @returns {{healed:number, wounds:{value:number, critical:number}, flagAt:number|null}|null}
 *   null — писать нечего
 */
export function planBruteRegen(system, lastAt, { from, to }) {
  if (!system?.wounds) return null;
  if (!isWounded(system.wounds)) return lastAt == null ? null : { healed: 0, wounds: null, flagAt: null };

  let at = lastAt == null ? Number(from) || 0 : Number(lastAt);
  const wounds = { ...system.wounds };
  const view = () => ({ ...system, wounds });
  let healed = 0;
  for (let i = 0; i < MAX_STEPS; i++) {
    if (!isWounded(wounds)) break;
    const due = at + BRUTE_REGEN_PERIOD[woundLevel(view()).key];
    if (due > to) break;
    const upd = computeWoundHealing({ wounds }, 1);
    wounds.value = upd["system.wounds.value"];
    wounds.critical = upd["system.wounds.critical"];
    healed++;
    at = due;
  }
  const flagAt = isWounded(wounds) ? at : null;
  if (!healed && flagAt === lastAt) return null;
  return { healed, wounds: healed ? { value: wounds.value, critical: wounds.critical } : null, flagAt };
}

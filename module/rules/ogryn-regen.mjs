// module/rules/ogryn-regen.mjs
// ════════════════════════════════════════════════════════════════════════════
//  «Физиология Громилы» (Огрин, корбук, глава I — Расы): «Если он легко
//  ранен, он пассивно восстанавливает 1 Рану в минуту, если тяжело ранен –
//  1 Рану в 10 минут, а если критически ранен – 1 Рану в час (Талант Hardy не
//  влияет)». Чистая арифметика без Foundry; часы Календаря и боевые Раунды
//  подаёт combat/ogryn-regen.mjs.
//
//  Банк секунд, а не метка «следующее лечение в»: время приходит двумя
//  валютами — прокрутка Календаря (worldTime) и боевые Раунды (в этой системе
//  Раунд worldTime не двигает, см. hooks.mjs у updateCombat), — и обе просто
//  докладывают секунды в один банк. Уровень ранения пересчитывается после
//  каждой вылеченной Раны: тяжело раненый, подлечившись до лёгкого, дальше
//  лечится по минуте, как говорит книга.
//
//  «Hardy не влияет» — уровень берётся по настоящим Ранам (rules/wound-tier.mjs),
//  без «всегда считается легко раненным» Таланта Hardy.
// ════════════════════════════════════════════════════════════════════════════

import { woundLevel } from "./wound-tier.mjs";
import { isWounded } from "./healing-clock.mjs";

/** Секунды на 1 Рану по уровню ранения. */
export const OGRYN_REGEN_PERIOD = Object.freeze({ light: 60, heavy: 600, critical: 3600 });

/** Боевой Раунд — 5 секунд (корбук, «Ход и Инициатива»). */
export const SECONDS_PER_COMBAT_ROUND = 5;

/** Имя возможности — её выдаёт Черта «Физиология Громилы». */
export const OGRYN_REGEN_FLAG = "brutePhysiology.passiveRegen";

/** Флаг актора с банком секунд. */
export const OGRYN_REGEN_BANK_FLAG = "ogrynRegenBank";

/**
 * Сколько Ран восстановилось за `addSeconds`, с учётом уже накопленного банка.
 * @param {object} system  system актора (wounds, characteristics.t.bonus)
 * @param {number} bank    накопленные секунды с прошлого раза
 * @param {number} addSeconds  сколько игрового времени прошло
 * @returns {{healed: number, bank: number, wounds: {value: number, critical: number}}}
 */
export function ogrynRegenStep(system, bank, addSeconds) {
  const wounds = {
    value: Number(system?.wounds?.value) || 0,
    critical: Number(system?.wounds?.critical) || 0
  };
  const max = Number(system?.wounds?.effectiveMax ?? system?.wounds?.max) || 0;
  const view = () => ({ ...system, wounds: { ...system?.wounds, ...wounds } });
  const woundedNow = () => isWounded({ ...system?.wounds, ...wounds });

  if (!woundedNow()) return { healed: 0, bank: 0, wounds };
  let left = Math.max(0, Number(bank) || 0) + Math.max(0, Number(addSeconds) || 0);
  let healed = 0;
  while (woundedNow()) {
    const period = OGRYN_REGEN_PERIOD[woundLevel(view()).key];
    if (left < period) break;
    left -= period;
    healed++;
    if (wounds.critical > 0) wounds.critical--;
    else wounds.value = max > 0 ? Math.min(max, wounds.value + 1) : wounds.value + 1;
  }
  return { healed, bank: woundedNow() ? left : 0, wounds };
}

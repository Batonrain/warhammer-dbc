// module/rules/hair-trigger.mjs
//
// Hair Trigger / Палец на Спуске (Талант Стрелка, wdbc-1rno.27/.37,
// capabilities.mjs rangedCore.core.hairTrigger): «Раз в Раунд при выстреле
// из Караула (до броска) персонаж проходит Awareness(P)+0 vs Awareness(P)+0;
// при победе действует первым независимо от Ag, и выстрел считается
// Незримым. Не работает с метательным, спреями и видимыми дозвуковыми
// снарядами.»
//
// Сам встречный тест Awareness vs Awareness НЕ розыгрывается движком — тот
// же уровень доверия столу, что у Blindside/Из Слепой Зоны (rules/
// unseen-talents.mjs, packs-src Talent-скрипт «Отметить цель»): и там, и
// здесь книга требует субъективный встречный тест по требованию, а не
// детектируемое условие. Что автоматизировано: гейт «раз в Раунд»
// (isRoundCapabilityAvailable, module/apps/game-session.mjs, вызывается из
// module/combat/overwatch.mjs), сама пометка «следующий выстрел из Караула —
// Незримый» и её разовое снятие атакой — ТОЧНО тот же примитив, что Hidden
// Threat/Сокрытая Угроза (rules/hidden-threat.mjs), только источник другой.
//
// «Действует первым независимо от Ag» читается отдельно, не флагом отсюда:
// module/combat/overwatch.mjs передаёт факт «стол подтвердил победу» прямо в
// simultaneousActionWinner как принудительный исход "reacting", минуя
// сравнение характеристик — победа в контесте книжно ПОДМЕНЯЕТ его целиком,
// не участвует в нём как ещё один параметр.

const NS = "warhammer-dbc";
const FLAG_KEY = "hairTriggerUnseenPending";

/** Талант куплен (capabilities.mjs rangedCore.core.hairTrigger). */
export const HAIR_TRIGGER_CAPABILITY = "rangedCore.core.hairTrigger";

/** Следующая атака этого актора уже помечена «Незримой» (выигранный контест). */
export function isHairTriggerUnseenPending(actor) {
  return !!actor?.getFlag?.(NS, FLAG_KEY);
}

/** Пометить следующую атаку — вызывается после того, как стол подтвердил победу в контесте. */
export async function markHairTriggerUnseenPending(actor) {
  await actor.setFlag(NS, FLAG_KEY, true);
}

/**
 * Снять пометку — ровно один раз, когда атака действительно случилась
 * (module/combat/attack.mjs, при сборке карточки), независимо от исхода:
 * книга даёт тип ОДНОЙ атаке, не длящемуся эффекту.
 * @returns {boolean} была ли пометка снята (false — её и не было)
 */
export async function consumeHairTriggerUnseenPending(actor) {
  if (!isHairTriggerUnseenPending(actor)) return false;
  await actor.unsetFlag(NS, FLAG_KEY);
  return true;
}

/**
 * Оружие допускает Hair Trigger («не работает с метательным, спреями и
 * видимыми дозвуковыми снарядами»). «Видимые дозвуковые снаряды» — не
 * структурное свойство в system (стрелы/болты «на глаз», в отличие от пуль);
 * программно не отличить от прочих дальнобойных — честно оставлено столу,
 * та же граница доверия, что у самого контеста.
 * @param {object} weaponSys  item.system оружия (для weaponClass)
 * @param {object} wp         агрегированные свойства (module/combat/weapon-properties.mjs
 *                            aggregateAuto) — тот же объект, что читает attack.mjs
 */
export function hairTriggerAllowedWeapon(weaponSys, wp) {
  if (!weaponSys) return false;
  if (weaponSys.weaponClass === "thrown") return false;
  if (wp?.spray) return false;
  return true;
}

// module/rules/melee-base.mjs
// ════════════════════════════════════════════════════════════════════════════
//  СОСТАВНЫЕ БАЗЫ РУКОПАШНОЙ АТАКИ (Безрассудный Натиск, Sahara 3-861e).
//
//  Безрассудный Натиск / Reckless Charge: «Проводя Натиск, персонаж может
//  скомбинировать его с Полной Атакой, получив все бонусы и штрафы последней
//  вместо бонусов Натиска. Считается одновременно Натиском и Полной Атакой.»
//
//  Поэтому База "recklessCharge" — не третья, а ДВОЙНАЯ: везде, где код спрашивал
//  «это Натиск?» или «это Полная Атака?», он теперь спрашивает baseIsCharge /
//  baseIsFullAttack, и составная База отвечает «да» на оба. Бонус приёма у неё
//  один — +30 Полной Атаки (MELEE_BASES.recklessCharge.wsBonus), а не +20 Натиска.
//
//  Чистый модуль без Foundry. Константы Баз — constants/combat.mjs.
// ════════════════════════════════════════════════════════════════════════════

/** Ключ составной Базы «Безрассудный Натиск». */
export const RECKLESS_CHARGE_BASE = "recklessCharge";

/** Чем «считается» База: простые — собой, составная — обеими. */
const ASPECTS = { [RECKLESS_CHARGE_BASE]: ["charge", "fullatk"] };

/** Из чего состоит База (для простой — она сама). */
export const baseAspects = baseKey => ASPECTS[baseKey] ?? [baseKey];

/** Эта База — Натиск (в том числе составной Безрассудный Натиск). */
export const baseIsCharge = baseKey => baseAspects(baseKey).includes("charge");

/** Эта База — Полная Атака (в том числе составной Безрассудный Натиск). */
export const baseIsFullAttack = baseKey => baseAspects(baseKey).includes("fullatk");

/**
 * Разрешена ли База списком Баз (Приём: `bases`). Составная База проходит, только если в списке
 * есть ОБЕ её части: Приём, разрешённый «Натиском и Стандартной», с Полной Атакой несовместим, и
 * Безрассудный Натиск ему не подходит. Пустой список — любая База.
 */
export function baseFitsList(list, baseKey) {
  if (!Array.isArray(list) || !list.length) return true;
  return baseAspects(baseKey).every(part => list.includes(part));
}

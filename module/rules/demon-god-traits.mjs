// module/rules/demon-god-traits.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Божественные Трейты демонов (dbc-114, 14.11.2026): чистая логика без Foundry.
//
//  Кровь Богу Крови (Кхорн): «Убив живое существо или изгнав другого демона, демон получает
//  +2 ко всему рукопашному урону (складывается, до максимума +8) до конца боя.»
//  Насмешка над Жизнью (Нургл): «Раз в Раунд, когда Раны опускаются ниже 0, демон может пройти
//  тест Т+10 и при Успехе остаться с 0 Ран. Не действует против священного оружия и
//  Варп-Нестабильности. Иммунитет ко всем ядам.»
// ════════════════════════════════════════════════════════════════════════════

export const BLOOD_GOD_CAP = "damage.bloodForTheBloodGod";
export const BLOOD_GOD_KILLS_FLAG = "bloodGodKills";
export const BLOOD_GOD_STEP = 2;
export const BLOOD_GOD_MAX = 8;

/** Бонус к рукопашному урону по числу убийств: +2 за каждое, не выше +8. */
export function bloodGodDamageBonus(kills) {
  return Math.min(BLOOD_GOD_MAX, Math.max(0, Math.trunc(Number(kills) || 0)) * BLOOD_GOD_STEP);
}

/** «Убил»: цель была в строю (Раны > 0) и выведена из строя (≤ 0) этим уроном. */
export function isKillingBlow(woundsBefore, woundsAfter) {
  return (Number(woundsBefore) || 0) > 0 && (Number(woundsAfter) || 0) <= 0;
}

export const MOCKERY_CAP = "wounds.mockeryOfLife";
export const MOCKERY_ROUND_FLAG = "mockeryOfLifeRound";
export const MOCKERY_TEST_MOD = 10;

/** Ключ Раунда боя; вне боя — пустая строка (Раундов нет, ограничения нет). */
export const mockeryRoundKey = combat => (combat?.id ? `${combat.id}:${Number(combat.round) || 0}` : "");

/** Можно ли в этом Раунде ещё пробовать. */
export function mockeryAvailable(usedKey, combat) {
  const key = mockeryRoundKey(combat);
  return !key || usedKey !== key;
}

/** Опустит ли непоглощённый урон Раны ниже 0. */
export function dropsBelowZero(currentWounds, netDamage) {
  return (Number(netDamage) || 0) > 0 && (Number(currentWounds) || 0) - (Number(netDamage) || 0) < 0;
}

/** Урон, при котором демон остаётся ровно с 0 Ран (не больше текущих Ран, не меньше 0). */
export function mockeryCappedDamage(currentWounds) {
  return Math.max(0, Number(currentWounds) || 0);
}

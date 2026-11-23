// module/rules/battle-music.mjs
// «Слышит музыку на N Успехов (считается как вживую)» — состояние Воина Ноты
// (Элитные архетипы, корбук стр. 151). Источники — Таланты Ария (клинки поют
// после теста Trade(Dancer)−10, до следующего Хода) и Увертюра (1 Очко
// Бесчестия: Cor.b Успехов на 1 Раунд). Читатель — Симфония: «Когда слышит
// музыку на 6+ Успехов… рукопашные и метательные атаки получают Felling
// (Успехи−5) и Precise» (combat/attack.mjs).
// Чистая часть без Foundry и без импортов.

export const MUSIC_FLAG = "hearingMusic";
export const SYMPHONY_MIN = 6;

const NS = "warhammer-dbc";

/**
 * Запись метки: rounds — сколько Раундов боя она живёт после текущего
 * (Ария — до следующего Хода: 1; Увертюра — «на 1 Раунд»: 0). Вне боя — минута.
 */
export function musicMark(deg, combat, { rounds = 0, now = 0 } = {}) {
  const d = Math.max(0, Math.trunc(Number(deg) || 0));
  return combat?.id
    ? { deg: d, combatId: combat.id, untilRound: (Number(combat.round) || 0) + rounds }
    : { deg: d, until: (Number(now) || 0) + 60 };
}

/** Сколько Успехов музыки слышит актор сейчас (0 — не слышит). */
export function musicDeg(actor, { combat = null, now = 0 } = {}) {
  const f = actor?.flags?.[NS]?.[MUSIC_FLAG];
  if (!f) return 0;
  if (f.combatId) {
    if (!combat?.id || combat.id !== f.combatId) return 0;
    return (Number(combat.round) || 0) <= (Number(f.untilRound) || 0) ? Number(f.deg) || 0 : 0;
  }
  if (combat?.id) return 0;
  return (Number(now) || 0) <= (Number(f.until) || 0) ? Number(f.deg) || 0 : 0;
}

/** Свойства Симфонии для этой атаки: [] — нет. */
export function symphonyProps(deg, { isMelee = false, thrown = false } = {}) {
  if (!(isMelee || thrown) || deg < SYMPHONY_MIN) return [];
  return [{ key: "felling", rating: deg - 5, rating2: 0 }, { key: "precise" }];
}

/** Ария «раз в Ход»: метка попытки — бой, Раунд и Ход (как MANTLE_SWAP_FLAG). */
export const ARIA_TURN_FLAG = "ariaTurn";

/** Метка Хода для Арии (null — вне боя, ограничения нет). */
export const ariaTurnMark = combat => combat?.id ? { combatId: combat.id, round: combat.round ?? 0, turn: combat.turn ?? 0 } : null;

/** Ария в этом Ходу уже звучала (тест брошен). */
export function ariaUsedThisTurn(actor, combat) {
  const key = ariaTurnMark(combat);
  const f = actor?.flags?.[NS]?.[ARIA_TURN_FLAG];
  return !!(key && f && f.combatId === key.combatId && f.round === key.round && f.turn === key.turn);
}

/** Ария: клинковое (isBlade — rules/melee-talents.mjs::isBladeWeapon) с Балансом не ниже 0. */
export function ariaWeaponOk(weapon, isBlade) {
  if (weapon?.type !== "weapon" || !isBlade?.(weapon)) return false;
  return (Number(weapon.system?.balance ?? 0) || 0) >= 0;
}

// module/rules/momentum.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Момент (Momentum, Гладиатор) — dbc-114, 14.11.2026, чистая логика без Foundry.
//
//  «Каждый раз, успешно нанося удары в рукопашной или метательным оружием, или успешно Избегая
//  вражеских атак, получает очко Момента; промахиваясь или получая попадание — теряет очко. Атаки,
//  попавшие, но отменённые Избеганием, Момент не меняют. Атаки с множественными попаданиями дают
//  или отнимают только одно очко. Может накапливать до A.b очков Момента (игнорируя Трейт
//  Unnatural A) и теряет их в конце боя. За каждое очко Момента получает +5 на все тесты WS, S и A.
//  Может тратить очки, чтобы добавлять +3 Успеха на успешные тесты по этим Характеристикам, или
//  обращать неудачные броски по ним (но не Критические Провалы) в Успехи с 1 уровнем Успеха.»
//
//  Бонус +5 за очко считает правило library/core.mjs (формула «momentum*5», переменная
//  mech-formula.mjs::mechRollData). Траты — кнопки на Черте (combat/momentum.mjs::spendMomentum).
// ════════════════════════════════════════════════════════════════════════════

export const MOMENTUM_CAP = "pool.momentum";
export const MOMENTUM_FLAG = "momentum";
/** Метка карточки атаки/урона, за которую очко уже начислено (многократные попадания — одно очко). */
export const MOMENTUM_SEEN_FLAG = "momentumSeen";
export const MOMENTUM_PER_POINT = 5;

/** Очки Момента актора из флага (0, если флага нет). Без проверки Черты: флаг ставит только Черта. */
export function momentumPoints(actor) {
  const v = actor?.flags?.["warhammer-dbc"]?.[MOMENTUM_FLAG] ?? actor?.getFlag?.("warhammer-dbc", MOMENTUM_FLAG);
  return Math.max(0, Math.trunc(Number(v) || 0));
}

/** Максимум очков: A.b без Unnatural A — то есть ⌊A / 10⌋ по значению. */
export function momentumMax(agTotal) {
  return Math.max(0, Math.floor((Number(agTotal) || 0) / 10));
}

/** Новое число очков после изменения: не ниже 0, не выше максимума. */
export function momentumAfter(current, delta, max) {
  const cur = Math.max(0, Math.trunc(Number(current) || 0));
  return Math.min(Math.max(0, Math.trunc(Number(max) || 0)), Math.max(0, cur + Math.trunc(Number(delta) || 0)));
}

/** Бонус к тестам WS, S, A за очки. */
export function momentumBonus(points) {
  return Math.max(0, Math.trunc(Number(points) || 0)) * MOMENTUM_PER_POINT;
}

/** Атака, дающая или отнимающая Момент: рукопашная или метательная (не стрелковая). */
export function momentumAttackCounts({ isMelee, weaponClass }) {
  return !!isMelee || weaponClass === "thrown";
}

/** Виды трат: ключ → что делает (подпись карточки) и снимаемое Состояние. */
export const MOMENTUM_SPENDS = Object.freeze({
  success3:      { label: "+3 Успеха к успешному тесту WS/S/A", note: "Добавьте +3 Успеха к только что успешному тесту WS, S или A." },
  flip:          { label: "Неудача → Успех (1 ступень)", note: "Обратите только что проваленный тест WS, S или A (не Критический Провал) в Успех с 1 уровнем Успеха." },
  ignoreStun:    { label: "Игнорировать Оглушение", note: "Эффект Оглушения игнорируется.", clears: "stunned" },
  ignoreBleed:   { label: "Игнорировать Кровотечение", note: "Эффект Кровотечения игнорируется.", clears: "bleeding" },
  ignoreFatigue: { label: "Игнорировать получение Усталости", note: "Получение Усталости игнорируется — уберите только что добавленную Усталость." },
  redSands:      { label: "Красные Пески: Беспомощен вместо смерти", note: "Смертельное ранение рукопашным/метательным оружием меняет Критический Эффект: противник Беспомощен вместо смерти." }
});

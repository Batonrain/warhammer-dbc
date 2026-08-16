// module/rules/fate-bonus.mjs
//
// Трата Очка Судьбы/Бесчестья на «+10 к броску».
//
// Бонус идёт В ПОРОГ, а выпавшее на кубе остаётся как есть. Прежняя правка
// значения куба (rv − 10) ломала две вещи: во-первых, от значения куба зависят
// критические результаты и место попадания (перевёрнутые цифры) — подменяя куб,
// мы подменяли и их; во-вторых, при низком броске вычитать было уже некуда
// (5 − 10 упиралось в 1), и лишняя Степень Успеха не появлялась, хотя по
// правилам +10 к тесту её даёт.

/** Сколько даёт одно Очко. */
export const FATE_BONUS = 10;

/**
 * Итог теста после надбавки. Куб не перебрасывается: меняется только порог.
 * Возвращает null, если порог или бросок не разобрались — тогда надбавку
 * применять не к чему и Очко тратить нельзя.
 */
export function fateBonusOutcome({ rv, threshold, bonus = FATE_BONUS } = {}) {
  // Number(null) === 0, поэтому пустое значение отсеиваем до приведения:
  // «порога не нашлось» и «порог равен нулю» — разные случаи.
  const num  = (v) => (v === null || v === undefined || v === "" ? NaN : Number(v));
  const roll = num(rv);
  const base = num(threshold);
  const add  = num(bonus);
  if (!Number.isFinite(roll) || !Number.isFinite(base) || !Number.isFinite(add)) return null;

  const raised  = base + add;
  const success = roll <= raised;
  // Степени считаются от нового порога — так же, как в обычном тесте.
  const degrees = Math.floor(Math.abs(raised - roll) / 10) + 1;
  return { base, bonus: add, threshold: raised, rv: roll, success, degrees };
}

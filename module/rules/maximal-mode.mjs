// module/rules/maximal-mode.mjs
// ════════════════════════════════════════════════════════════════════════════
//  МАКСИМАЛЬНЫЙ РЕЖИМ (свойство Maximal) — радиус Взрыва и дальность
//  (Sahara maximal-blast-10-rng). Чистые функции: ни бросков, ни Foundry.
//
//  Книга (core.json, свойство Maximal): «получив +10 Rng, +1d10 Dmg, +2 Pen,
//  +2 к радиусу свойства Blast, если оно у оружия есть, и свойство Recharge,
//  ценой удвоенного расхода боеприпасов». Кубы урона, Pen, Recharge и расход
//  считает combat/attack.mjs (attack-outcome.mjs) давно; здесь остальное:
//
//   - Blast: +2 к радиусу, ТОЛЬКО если у оружия Blast уже есть. Прежнее
//     описание свойства («получает Blast(2)») книге противоречило;
//   - Rng: +10 м к дальности — плоская надбавка после множителей (как
//     rangeMod боеприпаса), сдвигает полосы дальности в окне атаки.
//
//  Мастерство Плазмы (core.json, Талант «Оружейник»): «...с активированным
//  свойством Maximal оно получает ещё +2 к Dmg, Pen, и персонаж может также
//  дать ему +2 к радиусу свойства Blast. Если оружие не обладало свойством
//  Blast, персонаж может также дать оружию свойство Blast (2) в режиме
//  Maximal (не увеличивается этим Талантом и свойством Maximal)». Радиус —
//  ВЫБОР стрелка («может»), поэтому в окне атаки у плазмы с этим Талантом есть
//  своя галочка (opts.plasmaBlast); +2 Dmg/Pen считает plasmaMasteryBonus.
// ════════════════════════════════════════════════════════════════════════════

/** +10 Rng в Максимальном режиме. */
export const MAXIMAL_RNG_BONUS = 10;
/** +2 к радиусу Blast в Максимальном режиме (если Blast у оружия есть). */
export const MAXIMAL_BLAST_BONUS = 2;
/** +2 к радиусу Blast (или Blast (2) у оружия без него) по выбору обладателя Мастерства Плазмы. */
export const PLASMA_MASTERY_BLAST = 2;

/**
 * Радиус Взрыва в Максимальном режиме.
 * @param {object} p
 * @param {number} p.blast        радиус Blast оружия до режима (0 — свойства нет)
 * @param {boolean} p.maximalOn   Максимальный режим включён
 * @param {boolean} [p.masteryBlast] обладатель Мастерства Плазмы выбрал радиус (галочка окна)
 * @returns {number} радиус Взрыва, м (0 — Взрыва нет)
 */
export function maximalBlastRating({ blast, maximalOn, masteryBlast = false }) {
  const base = Math.max(0, Number(blast) || 0);
  if (!maximalOn) return base;
  if (base > 0) return base + MAXIMAL_BLAST_BONUS + (masteryBlast ? PLASMA_MASTERY_BLAST : 0);
  // Оружие без Blast: сам Maximal его не даёт, а Мастерство — Blast (2) без надбавок.
  return masteryBlast ? PLASMA_MASTERY_BLAST : 0;
}

/**
 * Подпись для карточки: что именно изменилось в радиусе.
 * @returns {string} пусто, если режим радиус не менял
 */
export function maximalBlastNote({ blast, maximalOn, masteryBlast = false }) {
  if (!maximalOn) return "";
  const base = Math.max(0, Number(blast) || 0);
  const now = maximalBlastRating({ blast: base, maximalOn, masteryBlast });
  if (now === base) return "";
  if (base === 0) return `Мастерство Плазмы: в Максимальном режиме оружие получает Blast (${now}).`;
  return `Радиус Blast ${base} → ${now} м`
    + (masteryBlast ? ` (Максимальный режим +${MAXIMAL_BLAST_BONUS}, Мастерство Плазмы +${PLASMA_MASTERY_BLAST}).` : ` (Максимальный режим +${MAXIMAL_BLAST_BONUS}).`);
}

/** Rng с учётом Максимального режима: +10 м плоско, после множителей. */
export function maximalRange(range, maximalOn) {
  const r = Number(range) || 0;
  return maximalOn && r > 0 ? r + MAXIMAL_RNG_BONUS : r;
}

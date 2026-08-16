// module/rules/legion-fit.mjs
//
// Свойство Legion / Легион — «приспособлено для силы и размеров Астартес».
// В книге это не памятка, а штрафы к использованию, и они идут в обе стороны:
//
//   • оружие с Legion в чужих руках: −10 за Размер меньше 1, −10 за Бонус Силы
//     меньше 7 и −10 за то, что руки (или перчатки) не сделаны под Астартес;
//   • Астартес с оружием БЕЗ Legion: −10 (гранаты не в счёт) — спусковая скоба
//     мала для его пальца.
//
// Считается по возможности `weapons.legion` (rules/flags.mjs), а не по расе:
// приспособленность к легионному оружию — это про сложение носителя, и её
// может дать не только раса Астартес.

/** Один шаг штрафа. Все слагаемые в книге одинаковы — по −10. */
export const LEGION_STEP = -10;

/** Возможность «сложен под легионное оружие» — её выдают правила расы. */
export const LEGION_FIT_FLAG = "weapons.legion";

/**
 * Штраф к тесту атаки за несоответствие оружия и носителя.
 *
 * @param {object}  o
 * @param {boolean} o.hasLegion  у оружия есть свойство Legion
 * @param {boolean} o.fitsLegion носитель сложен под легионное оружие (Астартес)
 * @param {number}  o.size       Размер носителя
 * @param {number}  o.sBonus     Бонус Силы носителя
 * @param {boolean} o.isGrenade  граната — исключение из штрафа Астартес
 * @returns {{total: number, parts: {label: string, value: number}[]}}
 */
export function legionAttackPenalty({ hasLegion = false, fitsLegion = false,
                                      size = 0, sBonus = 0, isGrenade = false } = {}) {
  const parts = [];

  if (hasLegion && !fitsLegion) {
    if ((Number(size)   || 0) < 1) parts.push({ label: "Легион: Размер меньше 1",   value: LEGION_STEP });
    if ((Number(sBonus) || 0) < 7) parts.push({ label: "Легион: Бонус Силы меньше 7", value: LEGION_STEP });
    // Руки под Астартес — то же сложение, что даёт fitsLegion; раз его нет,
    // хват не подогнан. Оружие можно доработать (R 0), и тогда предмет просто
    // теряет свойство Legion — отдельного признака для этого не нужно.
    parts.push({ label: "Легион: руки не под Астартес", value: LEGION_STEP });
  } else if (!hasLegion && fitsLegion && !isGrenade) {
    parts.push({ label: "Оружие не легионное (мала скоба)", value: LEGION_STEP });
  }

  return { total: parts.reduce((sum, p) => sum + p.value, 0), parts };
}

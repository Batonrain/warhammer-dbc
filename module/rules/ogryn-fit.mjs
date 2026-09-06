// module/rules/ogryn-fit.mjs
//
// Свойство Ogrynized / Огринизированное — «укреплено под силу Огрина и
// упрощено под его руки». Как и Legion (rules/legion-fit.mjs), это не памятка,
// а штрафы в обе стороны:
//
//   • оружие с Ogrynized в чужих руках: −10 за Размер меньше 1, −10 за Бонус
//     Силы меньше 10 и −10 за то, что руки (или перчатки) не изменены под
//     форму рук Огрина;
//   • Огрин с оружием БЕЗ Ogrynized: −10, а для стрелкового −20 — Черта расы
//     «Brute Physiology / Физиология Громилы» (constants/races.mjs) говорит
//     ровно это.
//
// Устроено по образцу Легиона намеренно: правило то же самое, отличаются
// только пороги и величина обратного штрафа, и расходиться этим двум расчётам
// незачем. Приспособленность спрашивается возможностью `weapons.ogryn`, а не
// расой: руки огринской формы бывают и у абхумана-мутанта, и у кибернетики.
//
// ЧЕГО ЗДЕСЬ НЕТ И ПОЧЕМУ:
//   • «Закрепление оружия убирает все эти штрафы» — в системе нет признака
//     закреплённого/установленного на станок оружия (ни поля, ни свойства);
//     когда появится, он должен обнулять ровно чужую сторону (первые три
//     слагаемых), как написано в книге.
//   • «Талант Bulging Biceps не работает» — отдельного вычитания не нужно:
//     Талант в этот расчёт и не входит, порог смотрит только на Бонус Силы.
//   • Поломка оружия при рукопашной атаке Огрина (1d10, на 1-3 ломается) — не
//     модификатор теста, а бросок ПОСЛЕ атаки; ему нужно своё место в
//     конвейере, здесь его нет.

/** Один шаг штрафа — как и у Легиона, все слагаемые по −10. */
export const OGRYN_STEP = -10;

/** Обратная сторона для стрелкового: Огрину «не по руке» вдвое хуже. */
export const OGRYN_RANGED_STEP = -20;

/** Возможность «сложен под огринское оружие» — её выдают правила расы. */
export const OGRYN_FIT_FLAG = "weapons.ogryn";

/**
 * Штраф к тесту атаки за несоответствие огринского оружия и носителя.
 *
 * @param {object}  o
 * @param {boolean} o.hasOgrynized  у оружия есть свойство Ogrynized
 * @param {boolean} o.fitsOgryn     носитель сложен под огринское оружие
 * @param {number}  o.size          Размер носителя
 * @param {number}  o.sBonus        Бонус Силы носителя
 * @param {boolean} o.isRanged      стрелковое (для обратной стороны это −20)
 * @param {boolean} o.ignoresSizeStrength  носитель снимает штрафы за Размер и
 *        Бонус Силы (Best.Q Откатная Перчатка, OVERSIZED_FIT_FLAG в
 *        rules/legion-fit.mjs) — «неудобная форма» при этом остаётся: книга
 *        даёт Перчатке ровно это и для Легиона, и для Огринов.
 * @returns {{total: number, parts: {label: string, value: number}[]}}
 */
export function ogrynAttackPenalty({ hasOgrynized = false, fitsOgryn = false,
                                     size = 0, sBonus = 0, isRanged = false,
                                     ignoresSizeStrength = false } = {}) {
  const parts = [];

  if (hasOgrynized && !fitsOgryn) {
    if (!ignoresSizeStrength && (Number(size)   || 0) < 1)  parts.push({ label: "Огрины: Размер меньше 1",     value: OGRYN_STEP });
    if (!ignoresSizeStrength && (Number(sBonus) || 0) < 10) parts.push({ label: "Огрины: Бонус Силы меньше 10", value: OGRYN_STEP });
    // Форма рук — то же сложение, что даёт fitsOgryn; раз его нет, хват не по
    // руке. Перчаткой не снимается: это и есть книжная «неудобная форма».
    parts.push({ label: "Огрины: руки не огринской формы", value: OGRYN_STEP });
  } else if (!hasOgrynized && fitsOgryn) {
    parts.push({
      label: isRanged ? "Оружие не огринское (стрелковое)" : "Оружие не огринское",
      value: isRanged ? OGRYN_RANGED_STEP : OGRYN_STEP
    });
  }

  return { total: parts.reduce((sum, p) => sum + p.value, 0), parts };
}

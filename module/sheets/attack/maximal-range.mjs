// module/sheets/attack/maximal-range.mjs
// ════════════════════════════════════════════════════════════════════════════
//  +10 Rng Максимального режима в живом окне атаки (Sahara maximal-blast-10-rng).
//
//  Окно открывается с галочкой «Максимальный режим» снятой: автоотметка полосы
//  дальности (Короткая/Боевая/…) посчитана от обычного Rng. Когда игрок
//  включает режим, дальность оружия растёт на 10 м (rules/maximal-mode.mjs), и
//  та же измеренная дистанция может попасть в другую полосу. Здесь окно
//  пересчитывает автоотметку и подсказку «Дистанции» вслед за галочкой.
//
//  Руками отмеченные полосы не трогаем: перестраиваем отметки, только пока
//  они ровно такие, какими их поставил сам расчёт («нетронутые»).
// ════════════════════════════════════════════════════════════════════════════

import { rangeBandKey } from "../../rules/tactical-map.mjs";
import { MAXIMAL_RNG_BONUS } from "../../rules/maximal-mode.mjs";

const setHidden = (el, hidden) => {
  if (!el) return;
  el.hidden = hidden;
  if (el.style) el.style.display = hidden ? "none" : "";
};

/**
 * @param {HTMLElement} form окно атаки
 * @param {?{edgeM:number, gripRange:number}} range измеренная дистанция и Rng оружия (null — считать нечего)
 * @returns {(maximal:boolean) => void} вызывать при каждом пересчёте окна
 */
export function createMaximalRangeSync(form, range) {
  if (!range) return () => {};
  let shown = false;
  const bonus = on => (on ? MAXIMAL_RNG_BONUS : 0);
  return maximal => {
    maximal = !!maximal;
    if (maximal === shown) return;
    const oldKey = rangeBandKey(range.edgeM, range.gripRange + bonus(shown));
    const newKey = rangeBandKey(range.edgeM, range.gripRange + bonus(maximal));
    shown = maximal;

    setHidden(form.querySelector(".atk-range-normal"), maximal);
    setHidden(form.querySelector(".atk-range-maximal"), !maximal);
    setHidden(form.querySelector("#atk-out-of-range"), newKey !== "out");

    // «Короткая дистанция / в упор» Рассеивания и Мельты: авто-галочка «дистанция ≤ Rng/2» (attack-dialog.mjs).
    const short = form.querySelector("#atk-shortrange");
    if (short && !short.disabled) {
      const was = range.edgeM <= (range.gripRange + bonus(!maximal)) / 2;
      if (short.checked === was) short.checked = range.edgeM <= (range.gripRange + bonus(maximal)) / 2;
    }

    const bands = [...form.querySelectorAll("input.atk-mod-cb[data-band]")];
    const untouched = bands.every(cb => cb.disabled || cb.checked === (cb.dataset.band === oldKey));
    if (!untouched) return;
    for (const cb of bands) {
      if (cb.disabled) continue;
      cb.checked = cb.dataset.band === newKey;
      cb.closest?.("label")?.classList?.toggle("atk-mod-auto", cb.checked);
    }
  };
}

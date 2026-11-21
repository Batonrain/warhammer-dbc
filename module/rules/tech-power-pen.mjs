// module/rules/tech-power-pen.mjs
// Пробитие Техночуда с формулой («Pen ½I.b» у Люминен Сокрушения, Литании
// Электроманта, Обращения к Шторму). Числовое поле `penetration` формулу не
// держит, поэтому рядом — строка `penetrationFormula`: «I.b/2», «½I.b»,
// «W.b+2». Итог — целое вниз, не меньше 0; пустая строка — 0.

import { resolveCharFormula } from "../helpers/utils.mjs";

/** Формула Пробития → число по Характеристикам актора. Неразборчивое — 0. */
export function techPenFormulaValue(formula, chars, corB = 0) {
  const raw = String(formula ?? "").trim();
  if (!raw) return 0;
  const expr = resolveCharFormula(raw.replace(/½\s*/g, "0.5*"), chars, corB).replace(/\s+/g, "");
  if (!/^[0-9+\-*/().]+$/.test(expr)) return 0;
  try {
    const v = Function(`"use strict"; return (${expr});`)();
    return Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0;
  } catch { return 0; }
}

/** Полное Пробитие Техночуда: число + формула. */
export function techPowerPenetration(sys, chars, corB = 0) {
  return (Number(sys?.penetration) || 0) + techPenFormulaValue(sys?.penetrationFormula, chars, corB);
}

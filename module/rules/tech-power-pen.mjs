// module/rules/tech-power-pen.mjs
// Пробитие Техночуда с формулой («Pen ½I.b» у Люминен Сокрушения, Литании
// Электроманта, Обращения к Шторму). Числовое поле `penetration` формулу не
// держит, поэтому рядом — строка `penetrationFormula`: «I.b/2», «½I.b»,
// «W.b+2». Итог — целое вниз; с пометкой книги «(окр.▲)» — вверх (решение
// Сергея 21.11.2026 для трёх Люминен: Pen ½I.b при I.b 5 = 3). Не меньше 0;
// пустая строка — 0.

import { resolveCharFormula } from "../helpers/utils.mjs";

/** Формула Пробития → число по Характеристикам актора. Неразборчивое — 0. */
export function techPenFormulaValue(formula, chars, corB = 0) {
  const raw = String(formula ?? "").trim();
  if (!raw) return 0;
  const roundUp = /окр\.?\s*▲|▲/.test(raw);
  const body = raw.replace(/\(?\s*окр\.?\s*[▲▼]\s*\)?|[▲▼]/g, "");
  const expr = resolveCharFormula(body.replace(/½\s*/g, "0.5*"), chars, corB).replace(/\s+/g, "");
  if (!/^[0-9+\-*/().]+$/.test(expr)) return 0;
  try {
    const v = Function(`"use strict"; return (${expr});`)();
    return Number.isFinite(v) ? Math.max(0, roundUp ? Math.ceil(v - 1e-9) : Math.floor(v)) : 0;
  } catch { return 0; }
}

/** Полное Пробитие Техночуда: число + формула. */
export function techPowerPenetration(sys, chars, corB = 0) {
  return (Number(sys?.penetration) || 0) + techPenFormulaValue(sys?.penetrationFormula, chars, corB);
}

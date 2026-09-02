// module/rules/mech-formula.mjs
//
// Формула для полей «Значение»/«Рейтинг» Конструктора МЕХАНИКА — вместо
// голого числа можно вписать выражение над бонусами Характеристик персонажа,
// в точности как их даёт книга: «cor/2» (½Cor.b), «ag*2» (A.b×2),
// «ceil(cor/2)» (½Cor.b, окр.▲), «s+2». Простое число («5») по-прежнему
// работает без изменений — это тот же путь, просто с одним термом.
//
// НЕ через Foundry Roll: там нет умножения/деления и округления, а этим
// полям дайсы не нужны — считается один раз в момент применения записи
// (тем же путём, что applyItemMechanics/syncMechanicsEffects, apps/mechanics.mjs),
// mechRollData(actor) даёт актуальные бонусы. Дайсовые формулы (Порча, Раны,
// Слаженность) — отдельный, уже существующий путь через evalFormula/Roll,
// этот модуль их не трогает.
//
// Безопасность важна не потому, что это сетевой ввод (правит его тот же
// ГМ/игрок, что имеет право писать в предмет), а чтобы опечатка не роняла
// исполнение молча куда-то не туда: чужой JS сюда протащить нельзя — после
// подстановки ключей допустимы только цифры, точка, пробел, скобки, +-*/, и
// имена из FUNCS. Всё остальное — ошибка формулы, а не тихий 0.
//
// Чистая функция, Foundry не нужен — проверяется test/rules/mech-formula.test.mjs.

const KEYS = ["ws", "bs", "s", "t", "ag", "int", "per", "wp", "fel", "inf", "cor", "pr"];

// Каноническая нотация системы — «X.b» (resolveCharFormula, module/helpers/
// utils.mjs: WS.b, Cor.b, однобуквенные A/I/P/W/F как алиасы Ag/Int/Per/WP/Fel).
// Автор, привыкший писать «Cor.b» в формулах урона, здесь получал бы молчаливую
// ошибку — поэтому «X.b» принимается наравне с короткими ключами KEYS и
// сводится к ним ДО подстановки значений: «Cor.b» ≡ «cor», «A.b» ≡ «ag».
// «pr» не входит в эту нотацию (не бонус характеристики, у него нет своего
// «.b») — просто ещё один короткий ключ KEYS, подставляется как есть.
const DOTB_ALIASES = { a: "ag", i: "int", p: "per", w: "wp", f: "fel" };
const DOTB_RE = /(?<![a-z])(ws|bs|ag|int|per|wp|fel|inf|cor|s|t|a|i|p|w|f)\.b(?![a-z0-9])/g;
const FUNC_NAMES = ["ceil", "floor", "round", "abs"];
const SAFE_REST = /^[\d.\s()+\-*/,]*$/;

/**
 * Короткие алиасы книжной нотации «X.b» — бонусы характеристик + Cor.b, плюс
 * «pr» — текущий Пси-Рейтинг (system.psyker.rating, wdbc-173l: психосилы вроде
 * Godkin/Muscle Mass дают «+3×PR»/«PR» аблативных Ран). Не бонус характеристики
 * и не завязан на DOTB_RE — просто ещё один короткий ключ KEYS.
 */
export function mechRollData(actor) {
  const c = actor?.system?.characteristics || {};
  const bonus = k => Number(c[k]?.bonus) || 0;
  const data = {
    cor: Number(actor?.system?.corruptionBonus) || 0,
    pr: Number(actor?.system?.psyker?.rating) || 0
  };
  for (const k of KEYS) if (k !== "cor" && k !== "pr") data[k] = bonus(k);
  return data;
}

/**
 * Формула → число. Пустая строка — 0. Число без переменных — быстрый путь.
 * Бросает Error на недопустимое выражение (небезопасные символы, не число
 * в итоге) — вызывающий код решает, что делать (в Конструкторе — это
 * подсказка автору, не тихая порча данных).
 */
export function mechFormulaTotal(formula, rollData = {}) {
  const raw = String(formula ?? "").trim();
  if (raw === "") return 0;
  // Голое число проходит как есть, С дробью: «0.5» (кг Веса) — это 0.5, а не 0.
  // Усечение к целому — только у формульного пути ниже, там оно намеренное.
  if (/^-?\d+(\.\d+)?$/.test(raw)) return Number(raw);

  let expr = raw.toLowerCase();
  expr = expr.replace(DOTB_RE, (m, tok) => DOTB_ALIASES[tok] || tok);

  // Длинные ключи раньше коротких — иначе "int" срежется по "in", которого нет,
  // но, например, случайный "ins" словил бы "in" как часть себя без \b-границы.
  for (const k of [...KEYS].sort((a, b) => b.length - a.length)) {
    expr = expr.replace(new RegExp(`\\b${k}\\b`, "g"), String(Number(rollData[k]) || 0));
  }

  const withoutFuncs = expr.replace(new RegExp(FUNC_NAMES.join("|"), "g"), "");
  if (!SAFE_REST.test(withoutFuncs))
    throw new Error(`недопустимая формула Механики: «${raw}»`);

  let result;
  try {
    // eslint-disable-next-line no-new-func -- строка уже прошла проверку SAFE_REST выше
    result = new Function("ceil", "floor", "round", "abs", `"use strict"; return (${expr});`)
      (Math.ceil, Math.floor, Math.round, Math.abs);
  } catch (e) {
    throw new Error(`формула Механики не разбирается: «${raw}»`);
  }
  if (!Number.isFinite(result))
    throw new Error(`формула Механики не дала число: «${raw}»`);
  return Math.trunc(result);
}

/** То же, что mechFormulaTotal, но недопустимая формула отдаёт 0, а не бросает. */
export function mechFormulaTotalSafe(formula, rollData = {}) {
  try { return mechFormulaTotal(formula, rollData); }
  catch (e) { return 0; }
}

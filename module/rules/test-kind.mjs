// module/rules/test-kind.mjs
//
// Вид теста — переключатель поверх обычного диалога броска (корбук, стр. 25-26),
// не отдельная подсистема: любой тест «теоретически» может стать Встречным,
// Комбинированным, Расширенным, получить Переброс или Преимущество/Помеху, а не
// только те места, где это захардкожено по одному разу (крафт, брифинг отряда,
// атака). Здесь — только чистая арифметика по книге, без Foundry: диалог
// (module/sheets/actor-sheet.mjs) собирает поля формы и вызывает эти функции.

/** Виды теста, доступные из диалога. Порядок — как в самой книге. */
export const TEST_KINDS = {
  base:        "Базовый",
  opposed:     "Встречный",
  opposedSafe: "Безопасный встречный",
  combined:    "Комбинированный",
  extended:    "Расширенный"
};

/**
 * Комбинированный тест (стр. 25): один Предел — наименьший (наихудший) из
 * задействованных. Тест проходит ОДНИМ броском против него.
 */
export function combinedThreshold(a, b) {
  return Math.min(Number(a) || 0, Number(b) || 0);
}

/**
 * Знаковая степень: Успех — положительное число, Провал — отрицательное. Так
 * формула разницы результатов встречного теста (стр. 25) считается одним
 * вычитанием вместо ветвления «оба успех / оба провал / успех против провала».
 */
function signedDeg({ deg, success }) {
  const d = Math.abs(Number(deg) || 0);
  return success ? d : -d;
}

/**
 * Встречный тест (стр. 25) — обе стороны уже бросили. Возвращает победителя и
 * итоговую степень уже на самом ВСТРЕЧНОМ тесте (не на исходном).
 *
 * Обычный: margin = разница знаковых степеней (успех 3 против провала 2 даёт
 * 3-(-2)=5, как в примере книги «Малфас»).
 *
 * Безопасный (vss, `safe: true`): если победитель преуспел, а проигравший
 * провалил СВОЙ тест — Провалы проигравшего в margin не идут, победитель
 * получает margin, равный только своей степени успеха. На «оба преуспели» и
 * «оба провалили» эта оговорка не действует — её в книге нет для этих случаев,
 * формула та же, что у обычного встречного теста.
 *
 * Ничья по степени (`sd1 === sd2`) решается более высоким Пределом теста —
 * победитель получает ровно 1 Уровень Успеха. Полная ничья (равны и степень, и
 * Предел) в книге не описана; возвращаем `winner: null` — решает ГМ.
 *
 * @param {{deg:number, success:boolean, threshold:number}} mine
 * @param {{deg:number, success:boolean, threshold:number}} theirs
 * @param {{safe?:boolean}} [opts]
 * @returns {{winner: "mine"|"theirs"|null, margin: number}}
 */
export function resolveOpposed(mine, theirs, { safe = false } = {}) {
  const sMine = signedDeg(mine), sTheirs = signedDeg(theirs);

  if (sMine === sTheirs) {
    const tMine = Number(mine?.threshold) || 0, tTheirs = Number(theirs?.threshold) || 0;
    if (tMine === tTheirs) return { winner: null, margin: 0 };
    return { winner: tMine > tTheirs ? "mine" : "theirs", margin: 1 };
  }

  const mineWins = sMine > sTheirs;
  const winnerSigned = mineWins ? sMine : sTheirs;
  const loserSigned  = mineWins ? sTheirs : sMine;
  const winnerSucceeded = mineWins ? !!mine?.success : !!theirs?.success;
  const loserSucceeded  = mineWins ? !!theirs?.success : !!mine?.success;

  const margin = (safe && winnerSucceeded && !loserSucceeded)
    ? winnerSigned
    : winnerSigned - loserSigned;

  return { winner: mineWins ? "mine" : "theirs", margin };
}

/** Режимы кубика, которые понимает {@link module:rules/reroll-pick.pickReroll}. */
const DICE_MODES = { advantage: "keepBest", disadvantage: "keepWorst" };

/**
 * Преимущество/Помеха (стр. 26) — та же механика «бросить дважды и взять
 * лучший/худший», что и именной Переброс от правил
 * (rules/resolve-test.mjs::rerollsFromRules), но доступна на любом тесте по
 * желанию игрока, а не только когда её выдаёт конкретная способность.
 *
 * @param {"normal"|"advantage"|"disadvantage"} choice
 * @returns {?{rolls:number, mode:"keepBest"|"keepWorst"}} null — обычный одиночный бросок
 */
export function diceModeFor(choice) {
  const mode = DICE_MODES[choice];
  return mode ? { rolls: 2, mode } : null;
}

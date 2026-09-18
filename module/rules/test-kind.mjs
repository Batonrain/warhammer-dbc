// module/rules/test-kind.mjs
//
// Вид теста — переключатель поверх обычного диалога броска (корбук, стр. 25-26),
// не отдельная подсистема: любой тест «теоретически» может стать Встречным,
// Комбинированным, Расширенным, получить Переброс или Преимущество/Помеху, а не
// только те места, где это захардкожено по одному разу (крафт, брифинг отряда,
// атака). Здесь — только чистая арифметика по книге, без Foundry: диалог
// (module/sheets/actor-sheet.mjs) собирает поля формы и вызывает эти функции.

import { SKILLS_DEF } from "../constants/skills.mjs";
import { CHARACTERISTICS } from "../constants/characteristics.mjs";

/**
 * Единый список «Навык или голая Характеристика» — тем же значением
 * (`"skill:<key>"`/`"char:<key>"`) пользуются панель «Расширенные тесты»
 * (sheets/sheet-helpers.mjs, wdbc-nysl) и второй столбец диалога
 * Комбинированного теста (sheets/actor-sheet.mjs, wdbc-y9i8) — единственное
 * место, где список заводится, чтобы не разъезжаться при правке Навыков.
 *
 * @returns {Array<{value:string, label:string, charKey:string}>}
 */
export function testTargetList() {
  return [
    ...Object.entries(SKILLS_DEF).map(([key, def]) => ({ value: `skill:${key}`, label: def.label, charKey: def.char })),
    ...Object.entries(CHARACTERISTICS).map(([key, meta]) => ({ value: `char:${key}`, label: meta.label, charKey: key }))
  ];
}

/**
 * Разбор значения селекта из {@link testTargetList} на составляющие.
 * Нераспознанное/пустое значение — Характеристика по умолчанию `fallbackChar`,
 * без Навыка: диалог не должен падать, если селект ещё не тронут.
 *
 * @param {?string} value       `"skill:<key>"`/`"char:<key>"`
 * @param {string}  fallbackChar
 * @returns {{skillKey:?string, charKey:string}}
 */
export function parseTestTarget(value, fallbackChar = "ag") {
  const [kind, key] = String(value ?? "").split(":");
  if (kind === "skill" && SKILLS_DEF[key]) return { skillKey: key, charKey: SKILLS_DEF[key].char };
  if (kind === "char" && CHARACTERISTICS[key]) return { skillKey: null, charKey: key };
  return { skillKey: null, charKey: fallbackChar };
}

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
 * Сверхъестественная Характеристика (стр. 26, wdbc-y9i8): если сторона,
 * которая иначе проиграла бы, владеет этим Трейтом для СВОЕЙ тестируемой
 * Характеристики, а победитель — не владеет им для СВОЕЙ, поражение гасится
 * до той же ничьей-по-Пределу, что и выше (margin строго 1, а не реальная
 * разница степеней) — ровно случай Амелии против Трорзака из примера 2.
 * `mine.unnatural`/`theirs.unnatural` — булев признак, есть ли у СТОРОНЫ
 * этот Трейт для характеристики, которой ОНА бросала (проверяется вызывающим
 * кодом через unnatural-characteristic.mjs, здесь только сравнение).
 *
 * @param {{deg:number, success:boolean, threshold:number, unnatural?:boolean}} mine
 * @param {{deg:number, success:boolean, threshold:number, unnatural?:boolean}} theirs
 * @param {{safe?:boolean}} [opts]
 * @returns {{winner: "mine"|"theirs"|null, margin: number, unnaturalTieBreak?: boolean}}
 */
export function resolveOpposed(mine, theirs, { safe = false } = {}) {
  const sMine = signedDeg(mine), sTheirs = signedDeg(theirs);

  const tieByThreshold = () => {
    const tMine = Number(mine?.threshold) || 0, tTheirs = Number(theirs?.threshold) || 0;
    if (tMine === tTheirs) return { winner: null, margin: 0 };
    return { winner: tMine > tTheirs ? "mine" : "theirs", margin: 1 };
  };

  if (sMine === sTheirs) return tieByThreshold();

  const mineWins = sMine > sTheirs;
  const loserUnnatural  = mineWins ? !!theirs?.unnatural : !!mine?.unnatural;
  const winnerUnnatural = mineWins ? !!mine?.unnatural : !!theirs?.unnatural;
  if (loserUnnatural && !winnerUnnatural) return { ...tieByThreshold(), unnaturalTieBreak: true };

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

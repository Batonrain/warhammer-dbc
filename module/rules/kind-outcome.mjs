// module/rules/kind-outcome.mjs
//
// Считает исход теста с учётом выбранного Вида (стр. 25-26): Комбинированный
// подменяет Порог на наименьший из двух, Расширенный копит банк Успехов на
// акторе, Встречный (с известным броском соперника) сравнивается сразу.
// Крит-диапазон, наоборот, не зависит от Вида — считается всегда.
//
// Раньше жила приватным методом actor-sheet.mjs (`_resolveKindOutcome`) —
// сюда вынесена без изменений в арифметике, чтобы её мог позвать любой
// диалог броска, а не только Навык/Характеристика. `actor` — параметр вместо
// `this.actor`, остальное дословно то же самое; test/sheets/skill-roll.test.mjs
// остаётся зелёным как доказательство, что вынос не сдвинул числа.

import { testOutcome, criticalOutcome } from "./roll-outcome.mjs";
import { resolveTest } from "./resolve-test.mjs";
import { combinedThreshold, resolveOpposed, TEST_KINDS } from "./test-kind.mjs";
import { extendedTestKey, applyGain } from "./extended-test.mjs";
import { critLineHtml } from "./test-kind-widget.mjs";
import { CHARACTERISTICS } from "../constants/characteristics.mjs";
import { esc } from "../helpers/utils.mjs";

/**
 * @param {object} actor документ актора (нужен для resolveTest и банка Расширенного)
 * @param {object} params
 * @param {string} [params.kind]
 * @param {number} params.baseEff  Порог до учёта Комбинированного (Сложность/усталость/etc уже внутри)
 * @param {number} params.rv       результат уже брошенного d100
 * @param {object} params.ctx      контекст для resolveTest (kind/char/skill/…)
 * @param {?{charKey:string, target:number}} [params.combined]
 * @param {?{label:string, goal:number}} [params.extended]
 * @param {?{threshold:number, roll:number}} [params.opposed]
 * @param {boolean} [params.autoSuccess] тест засчитан успешным независимо от
 *   броска (Беспомощная цель, Infamy ≥ рейтинг Страха и т.п.) — тот же смысл,
 *   что у одноимённого параметра testOutcome.
 * @returns {Promise<{eff:number, success:boolean, deg:number, crit:object,
 *   critLine:string, kindLabel:?string, combinedLine:string, extendedLine:string,
 *   opposedLine:string}>}
 */
export async function resolveKindOutcome(actor, { kind = "base", baseEff, rv, ctx, combined, extended, opposed, autoSuccess = false }) {
  const kindLabel = kind !== "base" ? TEST_KINDS[kind] : null;

  let eff = baseEff;
  let combinedLine = "";
  if (kind === "combined" && combined) {
    // Явный Предел (даже 0 не вводят намеренно — 0 здесь «не задан»), иначе
    // характеристика по ключу; ключ не распознан — второй половины нет, порог
    // остаётся базовым, а не схлопывается в 0 с гарантированным провалом.
    const otherChar = actor.system.characteristics?.[combined.charKey] ?? null;
    const otherEff = combined.target || (otherChar ? Number(otherChar.total) || 0 : baseEff);
    eff = combinedThreshold(baseEff, otherEff);
    const otherLabel = CHARACTERISTICS[combined.charKey]?.label ?? combined.charKey;
    const unresolved = !combined.target && !otherChar
      ? ` <span class="roll-failure">(характеристика «${esc(combined.charKey || "—")}» не распознана — вторая половина не учтена)</span>` : "";
    combinedLine = `<div class="roll-threshold">🔗 Комбинированный: второй Предел <b>${otherEff}</b> (${esc(otherLabel)})${unresolved} → итоговый Порог <b>${eff}</b></div>`;
  }

  const { success, deg: baseDeg } = testOutcome(rv, eff, { autoSuccess });
  const critRange = resolveTest(ctx).crit;
  const crit = criticalOutcome(rv, critRange);
  const critLine = critLineHtml(crit);

  let extendedLine = "";
  if (kind === "extended" && extended) {
    const key = extendedTestKey(extended.label);
    const flagPath = `extendedTests.${key}`;
    const prev = actor.getFlag("warhammer-dbc", flagPath) || { accumulated: 0 };
    const gain = success ? baseDeg : 0;
    const { accumulated, done } = applyGain(prev.accumulated, gain, extended.goal);
    await actor.setFlag("warhammer-dbc", flagPath, { accumulated, target: extended.goal });
    extendedLine = `<div class="roll-threshold">📈 Расширенный «${esc(extended.label)}»: +${gain} → Банк <b>${accumulated}</b>/${extended.goal}${done ? " — <b>ГОТОВО</b>" : ""}</div>`;
  }

  let opposedLine = "";
  if ((kind === "opposed" || kind === "opposedSafe") && opposed) {
    const mine = { deg: baseDeg, success, threshold: eff };
    const theirsOutcome = testOutcome(opposed.roll, opposed.threshold);
    const theirs = { ...theirsOutcome, threshold: opposed.threshold };
    const result = resolveOpposed(mine, theirs, { safe: kind === "opposedSafe" });
    const winnerLabel = result.winner === "mine" ? "Вы побеждаете"
      : result.winner === "theirs" ? "Соперник побеждает" : "Ничья — решает ГМ";
    opposedLine = `<div class="roll-threshold">⚔ ${winnerLabel}${result.winner ? `, margin <b>${result.margin}</b>` : ""}</div>`;
  }

  return { eff, success, deg: baseDeg, crit, critLine, kindLabel, combinedLine, extendedLine, opposedLine };
}

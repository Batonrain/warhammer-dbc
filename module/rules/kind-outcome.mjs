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
// Автозапуск kind:"script" по Крит.Успеху/Провалу (wdbc-1rno) — переиспользует
// тот же поиск записи и throttle, что кнопка «▶ Запустить» на листе предмета
// (apps/mechanics.mjs), и тот же исполнитель кода (apps/item-script.mjs).
import { getItemMechanics, findMechEntryById, scriptRunReady, markScriptRunUsed } from "../apps/mechanics.mjs";
import { executeItemCode } from "../apps/item-script.mjs";

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
/**
 * Запускает scriptTrigger-правила (wdbc-1rno), чей side совпадает с реальным
 * исходом (crit.success/crit.failure) — область (modScope) уже отобрана
 * в resolve-test.mjs::scriptTriggersFromRules, здесь только сверка стороны и
 * сам запуск. Ошибка одного скрипта не должна ронять весь бросок — тот же
 * принцип, что у ручной кнопки «▶ Запустить» (apps/mechanics.mjs::runMechScriptEntry).
 */
async function runScriptTriggers(actor, triggers, crit) {
  for (const t of triggers ?? []) {
    const matches = (t.side === "critSuccess" && crit.success) || (t.side === "critFailure" && crit.failure);
    if (!matches) continue;
    // .find, не Collection.get: actor.items здесь трактуется как обычный
    // перебираемый список — тот же приём, что у rules/predicates.mjs
    // (wearsPowerArmour и т.п.), а не Foundry-специфичный Map-метод.
    const item = (actor?.items ?? []).find(i => i.id === t.itemId);
    if (!item) continue;
    const entry = findMechEntryById(getItemMechanics(item), t.entryId);
    if (!entry || entry.kind !== "script") continue;
    const code = (entry.code || "").trim();
    if (!code) continue;
    if (!scriptRunReady(item, entry)) continue;
    try {
      await executeItemCode(item, code, null);
    } catch (e) {
      console.error(`Warhammer DBC | Ошибка авто-скрипта Механики «${entry.label || entry.id}» предмета «${item.name}»:`, e);
      continue;
    }
    if (entry.scriptThrottleUnit) await markScriptRunUsed(item, entry);
  }
}

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

  const { success, deg: rawDeg } = testOutcome(rv, eff, { autoSuccess });
  const resolved = resolveTest(ctx);
  const crit = criticalOutcome(rv, resolved.crit);
  const critLine = critLineHtml(crit);
  // failDegMod (wdbc-1rno: Sentient Cyst «+3 Провала при провале») — только
  // на провале, успешный тест не трогает; не может увести степень ниже 1
  // (та же граница, что testOutcome держит для success выше).
  const baseDeg = success ? rawDeg : Math.max(1, rawDeg + (resolved.failDegExtra || 0));
  // Автозапуск kind:"script" по Крит.Успеху/Провалу (wdbc-1rno: «Полимат»,
  // «Библиотека Акаши») — после того, как crit уже посчитан для ЭТОГО броска.
  await runScriptTriggers(actor, resolved.scriptTriggers, crit);

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

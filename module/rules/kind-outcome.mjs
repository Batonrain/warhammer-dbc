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
import { combinedThreshold, resolveOpposed } from "./test-kind.mjs";
import { extendedTestKey, applyGain } from "./extended-test.mjs";
import { unnaturalRating, unnaturalDegreeBonus, hasUnnaturalCharacteristic } from "./unnatural-characteristic.mjs";
import { critLineHtml } from "./test-kind-widget.mjs";
import { CHARACTERISTICS } from "../constants/characteristics.mjs";
import { esc, _degWord } from "../helpers/utils.mjs";
// Автозапуск kind:"script" по Крит.Успеху/Провалу (wdbc-1rno) — переиспользует
// тот же поиск записи и throttle, что кнопка «▶ Запустить» на листе предмета
// (apps/mechanics.mjs), и тот же исполнитель кода (apps/item-script.mjs).
import { getItemMechanics, findMechEntryById, scriptRunReady, markScriptRunUsed } from "../apps/mechanics.mjs";
import { executeItemCode } from "../apps/item-script.mjs";
import { egomaniaOverrideResult } from "./egomania.mjs";
import { hasRuleFlag } from "./flags.mjs";
import { PERSONAL_ADAPTATION_CAPABILITY, PERSONAL_ADAPTATION_FLAG,
         personalAdaptationCap, personalAdaptationBonusFor, nextPersonalAdaptationBonuses }
  from "./personal-adaptation.mjs";

/**
 * Виды теста — независимые: любое подмножество combined/extended/opposed
 * может быть задано разом на одном вызове (стр. 25-26, wdbc-y9i8, «довести по
 * букве правил» — книга нигде не пишет, что они взаимоисключающие: Крафт
 * часто и есть Комбинированный Расширенный, долгое состязание — Встречный
 * Расширенный, и т.д.). Раньше здесь была строка `kind`, и включалась ровно
 * одна ветка — теперь каждый блок гейтится присутствием СВОИХ данных.
 * Порядок исполнения важен для пересечений: Комбинированный подменяет `eff`
 * ПЕРЕД тем, как считается success/deg — поэтому Встречный и банк
 * Расширенного, если тоже заданы, уже видят Комбинированный Порог/степень, а
 * не исходный baseEff. Встречный сравнивает МОЮ (уже комбинированную) степень
 * с ОДНИМ броском соперника — соперник своего Комбинированного не получает
 * (решение пользователя, 18.09.2026: было бы вдвое больше полей ради редкого
 * случая, симметрию всегда можно завести вторым отдельным тестом).
 *
 * @param {object} actor документ актора (нужен для resolveTest и банка Расширенного)
 * @param {object} params
 * @param {number} params.baseEff  Порог до учёта Комбинированного (Сложность/усталость/etc уже внутри)
 * @param {number} params.rv       результат уже брошенного d100
 * @param {object} params.ctx      контекст для resolveTest (kind/char/skill/…)
 * @param {?{charKey:string, target:number, label?:string, assistCount?:number}} [params.combined]
 *   `target` — УЖЕ полностью посчитанный Предел второй половины (Сложность/
 *   автомодификаторы/Ассистенты внутри, см. actor-sheet.mjs::_runTest,
 *   wdbc-y9i8); `label` — точное имя второго Навыка/Характеристики для
 *   карточки (без него — обратная подстановка по charKey, только для голой
 *   Характеристики); `assistCount` — Ассистенты ВТОРОГО столбца, свои,
 *   отдельные от общих `assistCount`/`deg` теста.
 * @param {?{label:string, goal:number}} [params.extended]
 * @param {?{threshold:number, roll:number, safe?:boolean, unnatural?:boolean}} [params.opposed]
 *   `safe` — «vss», галочка рядом со Встречным, не отдельный Вид (стр. 26).
 * @param {boolean} [params.autoSuccess] тест засчитан успешным независимо от
 *   броска (Беспомощная цель, Infamy ≥ рейтинг Страха и т.п.) — тот же смысл,
 *   что у одноимённого параметра testOutcome.
 * @returns {Promise<{eff:number, success:boolean, deg:number, crit:object,
 *   critLine:string, kindLabel:?string, combinedLine:string,
 *   combinedAssistCount:?number, extendedLine:string, opposedLine:string}>}
 *   combinedAssistCount — null, если тест не Комбинированный или у второго
 *   столбца нет своих Ассистентов; иначе assistCount ТОГО столбца, чей Предел
 *   реально используется (ниже) — им и нужно заменить внешний assistCount
 *   при начислении «+N степени за Успех» (см. actor-sheet.mjs::_runTest).
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

export async function resolveKindOutcome(actor, { baseEff, rv, ctx, combined, extended, opposed,
    opposedSelected = false, opposedSafeSelected = false, autoSuccess = false }) {
  // opposedSelected/opposedSafeSelected — сама галочка «Встречный», отдельно
  // от opposed (данные соперника): полтеста без Порога/Броска соперника
  // (сравнивается вручную позже) — всё равно Встречный тест по RAW, шапка
  // карточки и бонус Персональной Адаптации должны это видеть, даже когда
  // самого сравнения (opposedLine ниже) ещё не происходит.
  const oppSelected = !!opposed || opposedSelected;
  const oppSafe = opposed ? !!opposed.safe : opposedSafeSelected;
  // kindLabel — только для шапки карточки («Медика · Комбинированный,
  // Расширенный»), список активных Видов через запятую, а не единственное
  // значение: их теперь может быть сколько угодно разом.
  const kindLabel = [
    combined ? "Комбинированный" : null,
    extended ? "Расширенный" : null,
    oppSelected ? (oppSafe ? "Безопасный встречный" : "Встречный") : null
  ].filter(Boolean).join(", ") || null;

  let eff = baseEff;
  // Personal Adaptation/Персональная Адаптация (Тзинч, wdbc-1rno): бонус
  // против КОНКРЕТНОЙ цели прошлых встречных тестов — диалог не может
  // показать его галочкой (вид теста выбирается уже ПОСЛЕ сбора модификаторов,
  // см. шапку rules/personal-adaptation.mjs), поэтому прибавляется прямо к
  // Порогу здесь же, своей строкой в карточке.
  let personalAdaptationLine = "";
  if (oppSelected && ctx?.targetActor
      && hasRuleFlag(actor, PERSONAL_ADAPTATION_CAPABILITY)) {
    const bonus = personalAdaptationBonusFor(
      actor.getFlag("warhammer-dbc", PERSONAL_ADAPTATION_FLAG) ?? [], ctx.targetActor.uuid, game.time?.worldTime ?? 0);
    if (bonus > 0) {
      eff += bonus;
      // wdbc-fyvv: НЕ через rollStatLine — эта строка не тест-плашка, а важная
      // для игрока информация (за что и на сколько вырос Порог, персонаж
      // копил это скрытно), прятать её за наведением мыши неверно так же, как
      // и у combinedLine ниже.
      personalAdaptationLine = `<div class="roll-threshold">🧠 Персональная Адаптация: +${bonus} против ${esc(ctx.targetActor.name)} → Порог <b>${eff}</b></div>`;
    }
  }
  let combinedLine = "";
  // combinedAssistCount (wdbc-y9i8): у каждого столбца Комбинированного —
  // свой пул Ассистентов, но «+1 степень при Успехе» книга даёт за помощь
  // ИМЕННО тому тесту, что реально бросается (тому, чей Предел ниже) — не за
  // оба сразу. null здесь значит «нет отдельного второго столбца» — тогда
  // снаружи (_runTest) используется обычный assistCount, как раньше.
  let combinedAssistCount = null;
  if (combined) {
    // Явный Предел (даже 0 не вводят намеренно — 0 здесь «не задан»), иначе
    // характеристика по ключу; ключ не распознан — второй половины нет, порог
    // остаётся базовым, а не схлопывается в 0 с гарантированным провалом.
    const otherChar = actor.system.characteristics?.[combined.charKey] ?? null;
    const otherEff = combined.target || (otherChar ? Number(otherChar.total) || 0 : baseEff);
    eff = combinedThreshold(baseEff, otherEff);
    // label (wdbc-y9i8) — диалог второго столбца теперь знает точное имя
    // второго Навыка/Характеристики и передаёт его явно, вместо обратной
    // подстановки по charKey (та работала только для голой Характеристики —
    // «For.Lore (Astartes Implants)» под именем «Интеллект» книге не верна).
    const otherLabel = combined.label || CHARACTERISTICS[combined.charKey]?.label || combined.charKey;
    const unresolved = !combined.target && !otherChar && !combined.label
      ? ` <span class="roll-failure">(характеристика «${esc(combined.charKey || "—")}» не распознана — вторая половина не учтена)</span>` : "";
    if (typeof combined.assistCount === "number") combinedAssistCount = otherEff <= baseEff ? combined.assistCount : null;
    const bAssistNote = combined.assistCount
      ? ` <span class="roll-dlg-note">(Ассистенты: <b>${combined.assistCount}</b>${combinedAssistCount === combined.assistCount ? `, +${combined.assistCount} к степени` : ""})</span>`
      : "";
    combinedLine = `<div class="roll-threshold">🔗 Комбинированный: второй Предел <b>${otherEff}</b> (${esc(otherLabel)})${unresolved} → итоговый Порог <b>${eff}</b>${bAssistNote}</div>`;
  }

  const { success, deg: rawDeg } = testOutcome(rv, eff, { autoSuccess });
  const resolved = resolveTest(ctx);
  const crit = criticalOutcome(rv, resolved.crit);
  const critLine = critLineHtml(crit);
  // Сверхъестественная Характеристика (стр. 26, wdbc-y9i8): +1 Успех за
  // каждые полные 2 рейтинга Unnatural — но ТОЛЬКО на Успехе, и только по
  // Характеристике, которой реально бросали (ctx.char — та же, что уже несёт
  // «Бросок с:»/testKey Расширенного; у Комбинированного это столбец А, у
  // второго столбца своего бонуса степени нет — отдельный, ещё не пройденный
  // случай пересечения двух механик). rating=0 у обычных акторов — Math.floor
  // даёт 0, unnaturalLine остаётся пустой, для всех остальных тестов это
  // no-op.
  const unnaturalRatingHere = success ? unnaturalRating(ctx?.actor, ctx?.char) : 0;
  const unnaturalBonus = unnaturalDegreeBonus(unnaturalRatingHere);
  const unnaturalLine = unnaturalBonus > 0
    ? `<div class="roll-threshold">🧬 Сверхъестественная Характеристика (${unnaturalRatingHere}): +${unnaturalBonus} ${_degWord(unnaturalBonus)}</div>`
    : "";
  // failDegMod (wdbc-1rno: Sentient Cyst «+3 Провала при провале») — только
  // на провале, успешный тест не трогает; не может увести степень ниже 1
  // (та же граница, что testOutcome держит для success выше).
  const baseDeg = success ? rawDeg + unnaturalBonus : Math.max(1, rawDeg + (resolved.failDegExtra || 0));
  // Автозапуск kind:"script" по Крит.Успеху/Провалу (wdbc-1rno: «Полимат»,
  // «Библиотека Акаши») — после того, как crit уже посчитан для ЭТОГО броска.
  await runScriptTriggers(actor, resolved.scriptTriggers, crit);

  let extendedLine = "";
  if (extended) {
    const key = extendedTestKey(extended.label);
    const flagPath = `extendedTests.${key}`;
    const prev = actor.getFlag("warhammer-dbc", flagPath) || { accumulated: 0 };
    const gain = success ? baseDeg : 0;
    const { accumulated, done } = applyGain(prev.accumulated, gain, extended.goal);
    // testKey (wdbc-nysl: панель «Расширенные тесты» на листе) — чем именно
    // бросали, чтобы «Переоткрыть» знал, какой Навык/Характеристику
    // предзаполнить, и чтобы игрок мог сменить их прямо в панели перед
    // повторным броском. skill есть только у теста Навыка (ctx.skill) —
    // характеристика тогда читается из ctx.char.
    const testKey = ctx?.skill ? `skill:${ctx.skill}` : (ctx?.char ? `char:${ctx.char}` : prev.testKey ?? null);
    await actor.setFlag("warhammer-dbc", flagPath, { accumulated, target: extended.goal, label: extended.label, testKey });
    extendedLine = `<div class="roll-threshold">📈 Расширенный «${esc(extended.label)}»: +${gain} → Банк <b>${accumulated}</b>/${extended.goal}${done ? " — <b>ГОТОВО</b>" : ""}</div>`;
  }

  let opposedLine = "";
  if (opposed) {
    // unnatural (стр. 26, wdbc-y9i8): «моя» сторона — свой актор/своя
    // Характеристика (ctx.char), всегда известны. «Их» сторона — только если
    // opposed.unnatural пришло от вызывающего кода (авто-встречный со
    // знакомым opponentActor, галочка в диалоге при ручном вводе, или ответ
    // соперника-игрока) — без этого поля тай-брейк просто не сработает,
    // как и до этой правки.
    const mine = { deg: baseDeg, success, threshold: eff, unnatural: hasUnnaturalCharacteristic(actor, ctx?.char) };
    const theirsOutcome = testOutcome(opposed.roll, opposed.threshold);
    const theirs = { ...theirsOutcome, threshold: opposed.threshold, unnatural: !!opposed.unnatural };
    // Egomania/Эгомания (Слаанеш, wdbc-1rno): «автоматически побеждает в
    // любом встречном тесте против социальных взаимодействий» — actor здесь
    // всегда бросающий («моя» сторона сравнения), соперник в этом пути
    // (NPC-автобросок) даже не несёт своего документа, только Порог/бросок —
    // проверить его собственную Эгоманию здесь физически нечем.
    const result = egomaniaOverrideResult(actor, ctx?.skill,
      "mine", resolveOpposed(mine, theirs, { safe: !!opposed.safe }));
    const winnerLabel = result.winner === "mine" ? "Вы побеждаете"
      : result.winner === "theirs" ? "Соперник побеждает" : "Ничья — решает ГМ";
    const unnaturalNote = result.unnaturalTieBreak
      ? ` <span class="roll-dlg-note">(🧬 Сверхъестественная Характеристика уравняла исход)</span>` : "";
    opposedLine = `<div class="roll-threshold">⚔ ${winnerLabel}${result.winner ? `, margin <b>${result.margin}</b>` : ""}${unnaturalNote}</div>`;

    // «После КАЖДОГО встречного теста» — растёт независимо от исхода выше
    // (книга не говорит «после победы»), поэтому запись безусловна.
    if (ctx?.targetActor && hasRuleFlag(actor, PERSONAL_ADAPTATION_CAPABILITY)) {
      const cap = personalAdaptationCap(actor.system?.corruptionBonus);
      const nextList = nextPersonalAdaptationBonuses(
        actor.getFlag("warhammer-dbc", PERSONAL_ADAPTATION_FLAG) ?? [], ctx.targetActor.uuid,
        game.time?.worldTime ?? 0, cap);
      await actor.setFlag("warhammer-dbc", PERSONAL_ADAPTATION_FLAG, nextList);
    }
  }

  return { eff, success, deg: baseDeg, crit, critLine, kindLabel, combinedLine, combinedAssistCount,
           personalAdaptationLine, extendedLine, opposedLine, unnaturalLine };
}

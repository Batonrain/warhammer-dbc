// module/rules/test-kind-widget.mjs
//
// Общий фрагмент «Вид теста» для диалогов броска: разметка + чтение формы.
// Раньше это было зашито один раз в actor-sheet.mjs (`_showSkillRollDialog`);
// при раскатке на остальные семь диалогов копировать его ещё раз было бы той
// же ошибкой, для которой в своё время завели rules/roll-outcome.mjs (формула
// базового теста была переписана вручную в 25 местах). Здесь — единственная
// копия разметки и чтения, по образцу rules/roll-mods.mjs.
//
// Чтение формы принимает не форму, а функцию `val(selector)`, потому что
// DialogV2 и старый Foundry `Dialog` читают форму по-разному:
//   DialogV2: val = sel => form.querySelector(sel)?.value ?? null
//   Dialog (jQuery): val = sel => { const $el = html.find(sel); return $el.length ? $el.val() : null; }
// Оба возвращают строку по селектору (для `.dice-mode-opt:checked` jQuery
// `.val()` на найденной радиокнопке даёт то же, что `.value` у DOM-узла) —
// разница только в адаптере на вызывающей стороне.

import { diceModeFor } from "./test-kind.mjs";
import { DIFFICULTY_STEPS, DEFAULT_DIFFICULTY } from "./difficulty.mjs";
import { extendedTestKey } from "./extended-test.mjs";
import { pickReroll } from "./reroll-pick.mjs";
import { esc } from "../helpers/utils.mjs";

/**
 * Бросок d100 с перебросом от правила: бросаем сколько сказано, оставляем
 * один (какой — решает rules/reroll-pick.mjs), отброшенные показываем в
 * карточке. Этот конвейер был переписан вручную в восьми диалогах — здесь
 * единственная копия, рядом с чтением того же виджета (mergeReroll).
 * `reroll.rolls` обычно ≥2 (Преимущество/Помеха/именной переброс), но может
 * быть ровно 1 — mergeReroll ставит это явно, когда именной переброс и
 * противоположный ему Кубик (стр. 26: «Преимущества и Помехи на один тест
 * нивелируют друг друга») гасят друг друга: переброс всё равно происходит
 * (галочка стоит), но без выбора лучшего/худшего. Поэтому пол — не
 * `Math.max(2, …)`, а сам `reroll.rolls`, если он задан явно.
 *
 * `confirmPick` (стр. 26: «Персонаж может выбрать применить и худший
 * результат») — по умолчанию ВЫКЛЮЧЕН: диалог решает сам, спрашивать ли,
 * своей отдельной галочкой («Спросить, если будет выбор») — так обычный
 * бросок с Преимуществом/Помехой/Перебросом остаётся одним кликом, как и
 * раньше, а не диалогом-на-диалоге на КАЖДОМ броске. Восемь мест, что уже
 * зовут эту функцию без третьего параметра, ведут себя ровно как до этой
 * правки.
 *
 * @param {{rolls:number, mode:string, label:string}|null} reroll
 * @param {{confirmPick?:boolean}} [opts]
 * @returns {Promise<{roll:Roll, rv:number, rolls:Roll[], rerollNote:string}>}
 */
export async function rollD100WithReroll(reroll, { confirmPick = false } = {}) {
  const rollCount = reroll ? Math.max(1, Number(reroll.rolls) || 2) : 1;
  const rolls = [];
  for (let i = 0; i < rollCount; i++) rolls.push(await new Roll("1d100").evaluate());
  const values = rolls.map(r => r.total);
  const auto = pickReroll(values, reroll?.mode);
  const picked = (confirmPick && rolls.length > 1 && new Set(values).size > 1)
    ? await confirmRollPick(values, auto)
    : auto;
  const rerollNote = reroll
    ? `<div class="roll-reroll-note">${esc(reroll.label)}: отброшено ${picked.dropped.join(", ")}</div>`
    : "";
  return { roll: rolls[picked.index], rv: picked.value, rolls, rerollNote };
}

/**
 * Даёт игроку заменить авто-выбранный результат Преимущества/Помехи/Переброса
 * на любой из отброшенных (стр. 26). Кнопка авто-выбора — `default: true`
 * (Enter/клик по умолчанию), поэтому обычный случай («беру как есть») —
 * тот же один клик, что и раньше; выбор другого значения — второй, явный клик.
 *
 * @param {number[]} values   все выпавшие значения, в порядке броска
 * @param {{value:number, index:number, dropped:number[]}} auto  авто-выбор pickReroll
 * @returns {Promise<{value:number, index:number, dropped:number[]}>}
 */
export async function confirmRollPick(values, auto) {
  const alt = values
    .map((v, i) => ({ v, i }))
    .filter(({ i }) => i !== auto.index);
  const result = await foundry.applications.api.DialogV2.wait({
    window: { title: "Кубик: выбор результата" },
    classes: ["wh-roll-dialog-window"],
    content: `<p>Выпало: ${values.join(", ")}. Обычно берётся <b>${auto.value}</b>.</p>`,
    buttons: [
      { action: "auto", label: `Взять ${auto.value} (как обычно)`, default: true, callback: () => auto },
      ...alt.map(({ v, i }) => ({
        action: `alt-${i}`, label: `Взять ${v}`,
        callback: () => ({ value: v, index: i, dropped: values.filter((_, j) => j !== i) })
      }))
    ],
    rejectClose: false
  });
  return result || auto;
}

/**
 * Разметка переключателя Вида теста + Сложности + трёх подблоков
 * (Комбинированный/Расширенный/Встречный). Кубик сюда не входит — он не
 * всегда нужен рядом с Видом теста (см. {@link diceModeHtml}), а
 * `#auto-outcome-note` вызывающий диалог добавляет сам, одной строкой, там,
 * где ему удобно по вёрстке.
 *
 * Виды теста — независимые галочки, не радиокнопки (стр. 25-26, wdbc-y9i8,
 * «довести по букве правил»): книга нигде не пишет, что Расширенный,
 * Комбинированный и Встречный взаимоисключающие — Крафт зачастую и есть
 * Комбинированный Расширенный тест, долгое состязание может идти Встречным
 * Расширенным, и т.д. Любое подмножество из четырёх галочек (Расширенный/
 * Комбинированный/Встречный/vss) может быть отмечено разом; арифметику
 * пересечений считает rules/kind-outcome.mjs — сюда попадает только разметка
 * и чтение того, что отмечено. «vss» — не отдельный Вид, а модификатор
 * Встречного (одна галочка рядом с ним, а не второй независимый Вид).
 *
 * @param {object}  [opts]
 * @param {string[]} [opts.defaultKinds]        какие галочки Вида отмечены
 *   заранее (например `["extended"]` — Панель «Расширенные тесты»
 *   переоткрывает тест уже с этой галочкой). Значения: "extended"/"combined"/
 *   "opposed"/"opposedSafe".
 * @param {string}  [opts.label]               подпись теста — умолчание для
 *   поля «Название» Расширенного
 * @param {string}  [opts.combinedSecondHtml]  своя разметка поля «Второй
 *   тест» (например, выпадающий список характеристик, как у Навыка/
 *   Характеристики) — по умолчанию свободное текстовое поле, годится любому
 *   диалогу без готового списка вторых тестов
 * @param {number}  [opts.defaultCombinedTarget] предзаполненный Предел второго
 * @param {?string} [opts.extendedDefaultLabel] предзаполненное «Название» блока
 *   Расширенного — если не задано, берётся общий `label` (имя Навыка/
 *   Характеристики). Панель «Расширенные тесты» (wdbc-nysl) подставляет сюда
 *   сохранённое название банка при «Переоткрыть», а не имя Навыка.
 * @param {number}  [opts.extendedDefaultGoal] предзаполненная «Нужно Успехов»
 * @param {?string} [opts.combinedBlockHtml] своя ПОЛНАЯ разметка `#combined-
 *   block` целиком, вместо `combinedSecondHtml`+«Предел второго» — диалог
 *   Навыка/Характеристики (wdbc-y9i8) подставляет сюда два полноценных
 *   столбца теста вместо одной строки выбора Характеристики. Другие диалоги
 *   (mount.mjs и т.п.) этот параметр не передают — для них ничего не
 *   меняется.
 */
export function testKindHtml({
  defaultKinds = [], label = "", combinedSecondHtml = null, defaultCombinedTarget = 0,
  extendedDefaultLabel = null, extendedDefaultGoal = 0, combinedBlockHtml = null
} = {}) {
  const has = k => defaultKinds.includes(k);
  const difficultyOptions = DIFFICULTY_STEPS.map(s =>
    `<option value="${s.value}" ${s.value === DEFAULT_DIFFICULTY ? "selected" : ""}>${s.label}</option>`).join("");
  const combinedSecond = combinedSecondHtml ?? `
    <div class="roll-dlg-row roll-dlg-subrow">
      <label>Второй тест:</label>
      <input id="combined-char-select" type="text" placeholder="например, Logic"/>
    </div>`;
  const combinedInner = combinedBlockHtml ?? `
      ${combinedSecond}
      <div class="roll-dlg-row roll-dlg-subrow">
        <label>Предел второго:</label>
        <input id="combined-target" type="number" value="${defaultCombinedTarget}"/>
      </div>`;

  return `
    <div class="roll-dlg-row roll-dlg-kind-row">
      <label>Вид теста:</label>
      <span class="test-kind-checks">
        <label class="test-kind-opt"><input type="checkbox" id="kind-extended" ${has("extended") ? "checked" : ""}/> Расширенный</label>
        <label class="test-kind-opt"><input type="checkbox" id="kind-combined" ${has("combined") ? "checked" : ""}/> Комбинированный</label>
        <label class="test-kind-opt"><input type="checkbox" id="kind-opposed" ${has("opposed") || has("opposedSafe") ? "checked" : ""}/> Встречный</label>
        <label class="test-kind-opt test-kind-safe" id="kind-opposed-safe-row" ${has("opposed") || has("opposedSafe") ? "" : "hidden"}>
          <input type="checkbox" id="kind-opposed-safe" ${has("opposedSafe") ? "checked" : ""}/> vss
        </label>
      </span>
    </div>
    <div class="roll-dlg-row">
      <label>Сложность:</label>
      <select id="test-difficulty">${difficultyOptions}</select>
    </div>
    <div id="combined-block" class="roll-dlg-subblock" ${has("combined") ? "" : "hidden"}>
      ${combinedInner}
    </div>
    <div id="extended-block" class="roll-dlg-subblock" ${has("extended") ? "" : "hidden"}>
      <div class="roll-dlg-row roll-dlg-subrow">
        <label>Название:</label>
        <input id="extended-label" type="text" value="${esc(extendedDefaultLabel ?? label)}"/>
      </div>
      <div class="roll-dlg-row roll-dlg-subrow">
        <label>Нужно Успехов:</label>
        <input id="extended-goal" type="number" value="${extendedDefaultGoal || 0}"/>
      </div>
      <div class="roll-dlg-row roll-dlg-subrow">
        <span id="extended-progress" class="roll-dlg-note"></span>
        <button type="button" id="extended-reset" class="roll-dlg-mini-btn">Сбросить</button>
      </div>
    </div>
    <div id="opposed-block" class="roll-dlg-subblock" ${has("opposed") || has("opposedSafe") ? "" : "hidden"}>
      <div class="roll-dlg-row roll-dlg-subrow">
        <label>Порог соперника:</label>
        <input id="opposed-threshold" type="number"/>
      </div>
      <div class="roll-dlg-row roll-dlg-subrow">
        <label>Бросок соперника:</label>
        <input id="opposed-roll" type="number"/>
      </div>
      <div class="roll-dlg-row roll-dlg-subrow" id="opposed-auto-row" hidden>
        <label><input type="checkbox" id="opposed-auto"/> <span id="opposed-auto-label"></span></label>
      </div>
      <div class="roll-dlg-row roll-dlg-subrow">
        <label><input type="checkbox" id="opposed-their-unnatural"/> Соперник владеет Сверхъестественной Характеристикой по этому тесту</label>
      </div>
      <div class="roll-dlg-note">Оставьте пустым, если сравнивать вручную.</div>
    </div>`;
}

/**
 * Разметка одной Сложности — для диалогов, которым не нужен Вид теста целиком.
 * @param {{id?:string}} [opts] свой id селекта (по умолчанию `#test-difficulty`)
 *   — второй столбец Комбинированного (wdbc-y9i8) заводит свою независимую
 *   Сложность рядом с общей, id должен не совпадать.
 */
export function difficultyHtml({ id = "test-difficulty" } = {}) {
  const difficultyOptions = DIFFICULTY_STEPS.map(s =>
    `<option value="${s.value}" ${s.value === DEFAULT_DIFFICULTY ? "selected" : ""}>${s.label}</option>`).join("");
  return `<div class="roll-dlg-row">
    <label>Сложность:</label>
    <select id="${id}">${difficultyOptions}</select>
  </div>`;
}

/** Читает только Сложность (для диалогов без Вида теста целиком). */
export function readDifficulty(val) {
  return parseInt(val("#test-difficulty")) || 0;
}

/** Разметка Кубика (Обычный/Преимущество/Помеха) отдельно от Вида теста. */
export function diceModeHtml() {
  return `<div class="roll-dlg-row">
    <label>Кубик:</label>
    <span class="dice-mode-group">
      <label class="dice-mode-opt-label"><input type="radio" name="dice-mode" class="dice-mode-opt" value="normal" checked/> Обычный</label>
      <label class="dice-mode-opt-label"><input type="radio" name="dice-mode" class="dice-mode-opt" value="advantage"/> Преимущество</label>
      <label class="dice-mode-opt-label"><input type="radio" name="dice-mode" class="dice-mode-opt" value="disadvantage"/> Помеха</label>
    </span>
  </div>`;
}

/**
 * Публичная карточка сравнения Встречного теста (wdbc-j814) — публикуется
 * клиентом СОПЕРНИКА сразу после его собственного броска (см.
 * module/sheets/actor-sheet.mjs::_rollSkill/_rollCharacteristic, параметр
 * opposedRequest): к этому моменту он знает обе стороны — свою (только что
 * бросил) и инициатора (пришла вместе с запросом, module/rules/
 * delegate-test.mjs::requestDelegatedTest). Не зависит от Foundry — то же
 * место, что и critLineHtml.
 * @param {{label:string, mineName:string, mine:{threshold:number,roll:number},
 *   theirsName:string, theirs:{threshold:number,roll:number},
 *   result:{winner:"mine"|"theirs"|null, margin:number}}} p
 */
export function opposedComparisonHtml({ label, mineName, mine, theirsName, theirs, result, theirsNote = "" }) {
  const winnerName = result.winner === "mine" ? mineName : result.winner === "theirs" ? theirsName : null;
  // unnaturalTieBreak (стр. 26, wdbc-y9i8): margin здесь уже посчитан
  // resolveOpposed по правилу тай-брейка — только называем причину игрокам,
  // чтобы «выиграл с margin 1 при формально меньших Успехах» не выглядело багом.
  const unnaturalNote = result.unnaturalTieBreak ? " <em>(🧬 Сверхъестественная Характеристика уравняла исход)</em>" : "";
  const winnerHtml = winnerName
    ? `Побеждает <b>${esc(winnerName)}</b>, margin <b>${result.margin}</b>${unnaturalNote}`
    : "Ничья — решает ГМ";
  return `
    <div class="wh-roll-result">
      <div class="roll-header">⚔ Встречный тест: ${esc(label)}</div>
      <div class="roll-threshold">${esc(mineName)}: Порог <b>${mine.threshold}</b>, бросок <b>${mine.roll}</b></div>
      <div class="roll-threshold">${esc(theirsName)}: Порог <b>${theirs.threshold}</b>, бросок <b>${theirs.roll}</b></div>
      ${theirsNote}
      <div class="roll-outcome">${winnerHtml}</div>
    </div>`;
}

/** Строка Критического Успеха/Провала для карточки в чате. Пустая строка, если не сработало. */
export function critLineHtml(crit) {
  if (crit?.success) return `<div class="roll-crit roll-crit-success">⚡ Критический Успех!</div>`;
  if (crit?.failure) return `<div class="roll-crit roll-crit-failure">💀 Критический Провал!</div>`;
  return "";
}

/**
 * Читает поля Вида теста/Сложности/подблоков. Виды — независимые галочки
 * (стр. 25-26, wdbc-y9i8): любое подмножество Расширенный/Комбинированный/
 * Встречный(+vss) может быть отмечено разом, поэтому здесь три НЕЗАВИСИМЫХ
 * `if`, а не одна ветка по единственному выбранному значению — старое поле
 * `kind` (строка) ушло совсем, resolveKindOutcome теперь смотрит только на
 * присутствие combined/extended/opposed.
 *
 * @param {(selector:string)=>?string} val     значение поля (select/text/number)
 * @param {(selector:string)=>boolean} checked состояние галочки — ОТДЕЛЬНО от
 *   `val`, потому что и jQuery `.val()`, и `form.querySelector(sel)?.value`
 *   для чекбокса дают статичный атрибут `value` ("on"), а не текущий
 *   `checked`; общего адаптера на оба случая нет, вызывающий диалог даёт
 *   `checked` рядом с `val` тем же способом (jQuery `.prop("checked")` /
 *   `form.querySelector(sel)?.checked`).
 * @param {{label?:string}} [opts]
 */
export function readTestKind(val, checked, { label = "" } = {}) {
  const difficulty = parseInt(val("#test-difficulty")) || 0;

  let combined = null;
  if (checked("#kind-combined")) {
    combined = { charKey: val("#combined-char-select"), target: parseInt(val("#combined-target")) || 0 };
  }
  let extended = null;
  if (checked("#kind-extended")) {
    const rawLabel = val("#extended-label");
    extended = { label: (rawLabel && rawLabel.trim()) || label, goal: parseInt(val("#extended-goal")) || 0 };
  }
  let opposed = null;
  if (checked("#kind-opposed")) {
    const oppThresholdRaw = val("#opposed-threshold");
    const oppRollRaw      = val("#opposed-roll");
    // Оба пустые (или отсутствуют — так их вернёт адаптер, если элемента нет)
    // значат «сравнивать вручную», а не «Порог/Бросок 0».
    if (oppThresholdRaw && oppRollRaw) {
      // safe (стр. 26) — «vss» рядом с «Встречный», а не отдельный Вид: одна
      // и та же формула сравнения (resolveOpposed), только со своей оговоркой.
      opposed = { threshold: parseInt(oppThresholdRaw) || 0, roll: parseInt(oppRollRaw) || 0, safe: checked("#kind-opposed-safe") };
    }
  }
  return { difficulty, combined, extended, opposed };
}

/** Выбор Кубика: `val` должен принять `".dice-mode-opt:checked"` и отдать value. */
export function readDiceChoice(val) {
  return val(".dice-mode-opt:checked") || "normal";
}

/**
 * Именной переброс (от правила) и выбор Кубика игрока — независимые галочки
 * одного диалога, оба МОГУТ стоять одновременно. Раньше именной безусловно
 * перебивал Кубик, из-за чего Преимущество/Помеха на этом тесте молча
 * терялись при использовании переброса — а стр. 26 прямо требует обратного:
 * «Если тест имел Преимущество или Помеху, переброс сохраняет этот эффект».
 *
 * Согласованные режимы (оба keepBest или оба keepWorst) складывают число
 * бросков — тот же эффект переброса, только с более широким выбором.
 * Противоположные (именной keepWorst против выбранного игроком Преимущества,
 * или наоборот) — та же оговорка «Преимущества и Помехи на один тест
 * нивелируют друг друга» из следующего абзаца книги: гасятся друг другом,
 * переброс всё равно происходит (это отдельная галочка, её никто не снимал),
 * но уже без выбора лучшего/худшего — один новый бросок принимается как есть
 * (см. rollD100WithReroll — там за это отвечает `rolls: 1`).
 */
export function mergeReroll(namedReroll, diceChoice) {
  const diceMode = diceModeFor(diceChoice);
  if (!namedReroll) {
    return diceMode ? { ...diceMode, label: diceChoice === "advantage" ? "Преимущество" : "Помеха" } : null;
  }
  if (!diceMode) return namedReroll;
  const diceLabel = diceChoice === "advantage" ? "Преимущество" : "Помеха";
  if (namedReroll.mode === diceMode.mode) {
    return { ...namedReroll, rolls: Math.max(namedReroll.rolls, diceMode.rolls), label: `${namedReroll.label} + ${diceLabel}` };
  }
  return { ...namedReroll, rolls: 1, label: `${namedReroll.label} (${diceLabel} нивелирована)` };
}

/**
 * Живое поведение: показ/скрытие подблоков по смене Вида, прогресс банка
 * Расширенного, предупреждение Автоуспех/Автопровал. `root` — обычный
 * DOM-узел: `dialog.element` у DialogV2, `html[0]` у jQuery-обёртки старого
 * `Dialog` (то же самое, что делает test/support/foundry-stub.mjs).
 *
 * `getBaseEff` вызывающий диалог даёт сам — набор полей, из которых считается
 * предварительный Порог, у каждого диалога свой, здесь его не угадать.
 *
 * @returns {{updateAutoOutcomeNote:Function}} чтобы вызвать её из своих же
 *   слушателей (изменение Цели/Модификатора/ассистентов и т.п.)
 */
export function wireTestKindLive(root, { actor = null, getBaseEff = null, label = "" } = {}) {
  // Виды — независимые галочки (стр. 25-26, wdbc-y9i8): любое подмножение
  // видимо разом, поэтому у каждого подблока своя галочка-переключатель, а не
  // общий select. «vss» — модификатор Встречного, её строка живёт только
  // вместе с ним.
  const extendedCheck  = root.querySelector("#kind-extended");
  const combinedCheck  = root.querySelector("#kind-combined");
  const opposedCheck   = root.querySelector("#kind-opposed");
  const safeCheck      = root.querySelector("#kind-opposed-safe");
  const safeRow        = root.querySelector("#kind-opposed-safe-row");
  const combinedBlock = root.querySelector("#combined-block");
  const extendedBlock = root.querySelector("#extended-block");
  const opposedBlock  = root.querySelector("#opposed-block");
  // normalBlock (wdbc-y9i8) — есть только у диалога Навыка/Характеристики:
  // тот единственный, у кого Комбинированный теперь занимает ВЕСЬ блок теста
  // двумя столбцами вместо одной строки «Второй тест», поэтому обычные
  // Цель/Модификатор/Ассистенты/модификаторы прячутся на время Комбинированного
  // (actor-sheet.mjs сам переносит их в столбец А). У остальных диалогов
  // такого id нет — querySelector тут же вернёт null, .hidden не тронется.
  const normalBlock = root.querySelector("#normal-test-block");
  const updateKindVisibility = () => {
    const isCombined = !!combinedCheck?.checked;
    const isOpposed  = !!opposedCheck?.checked;
    if (combinedBlock) combinedBlock.hidden = !isCombined;
    if (extendedBlock) extendedBlock.hidden = !extendedCheck?.checked;
    if (opposedBlock)  opposedBlock.hidden  = !isOpposed;
    if (safeRow)        safeRow.hidden       = !isOpposed;
    if (normalBlock)   normalBlock.hidden   = isCombined;
  };
  extendedCheck?.addEventListener("change", updateKindVisibility);
  combinedCheck?.addEventListener("change", updateKindVisibility);
  opposedCheck?.addEventListener("change", updateKindVisibility);
  safeCheck?.addEventListener("change", updateKindVisibility);
  updateKindVisibility();

  const extendedLabelInput = root.querySelector("#extended-label");
  const extendedProgress   = root.querySelector("#extended-progress");
  const refreshExtendedProgress = () => {
    if (!extendedProgress || !actor) return;
    const key = extendedTestKey(extendedLabelInput?.value || label);
    const bank = actor.getFlag("warhammer-dbc", `extendedTests.${key}`);
    extendedProgress.textContent = bank
      ? `Накоплено: ${bank.accumulated}${bank.target ? `/${bank.target}` : ""}`
      : "Банк пуст";
  };
  extendedLabelInput?.addEventListener("input", refreshExtendedProgress);
  root.querySelector("#extended-reset")?.addEventListener("click", async () => {
    if (!actor) return;
    const key = extendedTestKey(extendedLabelInput?.value || label);
    await actor.unsetFlag("warhammer-dbc", `extendedTests.${key}`);
    refreshExtendedProgress();
  });
  refreshExtendedProgress();

  const updateAutoOutcomeNote = () => {
    const note = root.querySelector("#auto-outcome-note");
    if (!note || !getBaseEff) return;
    const eff = getBaseEff();
    if (eff >= 70) note.innerHTML = `⚠ Порог <b>${eff}</b> — можно засчитать Автоуспехом`;
    else if (eff <= 0) note.innerHTML = `⚠ Порог <b>${eff}</b> — Автопровал`;
    else note.textContent = "";
  };
  root.querySelector("#test-difficulty")?.addEventListener("change", updateAutoOutcomeNote);
  updateAutoOutcomeNote();

  return { updateAutoOutcomeNote, updateKindVisibility };
}

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

import { TEST_KINDS, diceModeFor } from "./test-kind.mjs";
import { DIFFICULTY_STEPS, DEFAULT_DIFFICULTY } from "./difficulty.mjs";
import { extendedTestKey } from "./extended-test.mjs";
import { esc } from "../helpers/utils.mjs";

/**
 * Разметка переключателя Вида теста + Сложности + трёх подблоков
 * (Комбинированный/Расширенный/Встречный). Кубик сюда не входит — он не
 * всегда нужен рядом с Видом теста (см. {@link diceModeHtml}), а
 * `#auto-outcome-note` вызывающий диалог добавляет сам, одной строкой, там,
 * где ему удобно по вёрстке.
 *
 * @param {object}  [opts]
 * @param {string}  [opts.defaultKind]         предустановленный Вид
 * @param {string}  [opts.label]               подпись теста — умолчание для
 *   поля «Название» Расширенного
 * @param {string}  [opts.combinedSecondHtml]  своя разметка поля «Второй
 *   тест» (например, выпадающий список характеристик, как у Навыка/
 *   Характеристики) — по умолчанию свободное текстовое поле, годится любому
 *   диалогу без готового списка вторых тестов
 * @param {number}  [opts.defaultCombinedTarget] предзаполненный Предел второго
 */
export function testKindHtml({
  defaultKind = "base", label = "", combinedSecondHtml = null, defaultCombinedTarget = 0
} = {}) {
  const kindOptions = Object.entries(TEST_KINDS).map(([key, kLabel]) =>
    `<option value="${key}" ${key === defaultKind ? "selected" : ""}>${kLabel}</option>`).join("");
  const difficultyOptions = DIFFICULTY_STEPS.map(s =>
    `<option value="${s.value}" ${s.value === DEFAULT_DIFFICULTY ? "selected" : ""}>${s.label}</option>`).join("");
  const combinedSecond = combinedSecondHtml ?? `
    <div class="roll-dlg-row roll-dlg-subrow">
      <label>Второй тест:</label>
      <input id="combined-char-select" type="text" placeholder="например, Logic"/>
    </div>`;

  return `
    <div class="roll-dlg-row">
      <label>Вид теста:</label>
      <select id="test-kind">${kindOptions}</select>
    </div>
    <div class="roll-dlg-row">
      <label>Сложность:</label>
      <select id="test-difficulty">${difficultyOptions}</select>
    </div>
    <div id="combined-block" class="roll-dlg-subblock" hidden>
      ${combinedSecond}
      <div class="roll-dlg-row roll-dlg-subrow">
        <label>Предел второго:</label>
        <input id="combined-target" type="number" value="${defaultCombinedTarget}"/>
      </div>
    </div>
    <div id="extended-block" class="roll-dlg-subblock" hidden>
      <div class="roll-dlg-row roll-dlg-subrow">
        <label>Название:</label>
        <input id="extended-label" type="text" value="${esc(label)}"/>
      </div>
      <div class="roll-dlg-row roll-dlg-subrow">
        <label>Нужно Успехов:</label>
        <input id="extended-goal" type="number" value="0"/>
      </div>
      <div class="roll-dlg-row roll-dlg-subrow">
        <span id="extended-progress" class="roll-dlg-note"></span>
        <button type="button" id="extended-reset" class="roll-dlg-mini-btn">Сбросить</button>
      </div>
    </div>
    <div id="opposed-block" class="roll-dlg-subblock" hidden>
      <div class="roll-dlg-row roll-dlg-subrow">
        <label>Порог соперника:</label>
        <input id="opposed-threshold" type="number"/>
      </div>
      <div class="roll-dlg-row roll-dlg-subrow">
        <label>Бросок соперника:</label>
        <input id="opposed-roll" type="number"/>
      </div>
      <div class="roll-dlg-note">Оставьте пустым, если сравнивать вручную.</div>
    </div>`;
}

/** Разметка одной Сложности — для диалогов, которым не нужен Вид теста целиком. */
export function difficultyHtml() {
  const difficultyOptions = DIFFICULTY_STEPS.map(s =>
    `<option value="${s.value}" ${s.value === DEFAULT_DIFFICULTY ? "selected" : ""}>${s.label}</option>`).join("");
  return `<div class="roll-dlg-row">
    <label>Сложность:</label>
    <select id="test-difficulty">${difficultyOptions}</select>
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

/** Строка Критического Успеха/Провала для карточки в чате. Пустая строка, если не сработало. */
export function critLineHtml(crit) {
  if (crit?.success) return `<div class="roll-crit roll-crit-success">⚡ Критический Успех!</div>`;
  if (crit?.failure) return `<div class="roll-crit roll-crit-failure">💀 Критический Провал!</div>`;
  return "";
}

/**
 * Читает поля Вида теста/Сложности/подблоков.
 * @param {(selector:string)=>?string} val
 * @param {{label?:string}} [opts]
 */
export function readTestKind(val, { label = "" } = {}) {
  const kind = val("#test-kind") || "base";
  const difficulty = parseInt(val("#test-difficulty")) || 0;

  let combined = null;
  if (kind === "combined") {
    combined = { charKey: val("#combined-char-select"), target: parseInt(val("#combined-target")) || 0 };
  }
  let extended = null;
  if (kind === "extended") {
    const rawLabel = val("#extended-label");
    extended = { label: (rawLabel && rawLabel.trim()) || label, goal: parseInt(val("#extended-goal")) || 0 };
  }
  let opposed = null;
  if (kind === "opposed" || kind === "opposedSafe") {
    const oppThresholdRaw = val("#opposed-threshold");
    const oppRollRaw      = val("#opposed-roll");
    // Оба пустые (или отсутствуют — так их вернёт адаптер, если элемента нет)
    // значат «сравнивать вручную», а не «Порог/Бросок 0».
    if (oppThresholdRaw && oppRollRaw) {
      opposed = { threshold: parseInt(oppThresholdRaw) || 0, roll: parseInt(oppRollRaw) || 0 };
    }
  }
  return { kind, difficulty, combined, extended, opposed };
}

/** Выбор Кубика: `val` должен принять `".dice-mode-opt:checked"` и отдать value. */
export function readDiceChoice(val) {
  return val(".dice-mode-opt:checked") || "normal";
}

/**
 * Именной переброс (от правила) важнее общего выбора Кубика — если он есть,
 * он и расходуется; иначе действует Преимущество/Помеха.
 */
export function mergeReroll(namedReroll, diceChoice) {
  const diceMode = diceModeFor(diceChoice);
  return namedReroll || (diceMode
    ? { ...diceMode, label: diceChoice === "advantage" ? "Преимущество" : "Помеха" }
    : null);
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
  const kindSelect    = root.querySelector("#test-kind");
  const combinedBlock = root.querySelector("#combined-block");
  const extendedBlock = root.querySelector("#extended-block");
  const opposedBlock  = root.querySelector("#opposed-block");
  const updateKindVisibility = () => {
    const kind = kindSelect?.value || "base";
    if (combinedBlock) combinedBlock.hidden = kind !== "combined";
    if (extendedBlock) extendedBlock.hidden = kind !== "extended";
    if (opposedBlock)  opposedBlock.hidden  = !(kind === "opposed" || kind === "opposedSafe");
  };
  kindSelect?.addEventListener("change", updateKindVisibility);
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

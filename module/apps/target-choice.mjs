// module/apps/target-choice.mjs
// ════════════════════════════════════════════════════════════════════════
//  Пикер цели Таланта (Hatred/Peer/Good Reputation) для строк выбора
//  Родного мира и Предсказания.
//
//  Раньше игрок ВПИСЫВАЛ, кого ненавидит персонаж, свободным текстом —
//  targetMatches() (rules/talent-targets.mjs) сравнивает цели по ключам
//  дерева фракций/рас/признаков, и произвольная строка под них никогда не
//  подходит: талант формально есть, а срабатывать не может. Здесь — тот же
//  набор видов цели (Фракция/Раса/Признак/Покровительство/Все!), что и у
//  ГМ-редактора на листе Таланта (sheets/item-sheet.mjs, «＋ цель…»), но
//  ужатый в одну строку выбора внутри уже существующего диалога/шага, а не
//  отдельная цепочка Dialog'ов — здесь выбирает игрок при создании, а не ГМ
//  при правке библиотеки.
// ════════════════════════════════════════════════════════════════════════

import { TARGET_KINDS, TARGET_FEATURES, PATRON_ANY,
         raceTarget, featureTarget, patronTarget, allTarget, factionTarget, targetLabel }
  from "../rules/talent-targets.mjs";
import { RACES, SUBRACES } from "../constants/races.mjs";
import { CHAOS_PATRONS } from "../constants/chaos-patron.mjs";
import { esc } from "../helpers/utils.mjs";

/**
 * Виды, доступные тут. «Тип существа» (actorType) исключён сознательно —
 * это средство ГМ-редактора Талантов (различать акторов техники/etc.), а не
 * то, что выбирает игрок себе Ненависть/Связи при создании.
 */
export const TARGET_CHOICE_KINDS = ["faction", "race", "feature", "patron", "all"];

/** Расы и субрасы одним списком: «Ненависть к Нагам» и «Ненависть к Париям» — цели одного вида (см. raceTarget в talent-targets.mjs). */
export function raceValueOptions() {
  const opts = Object.entries(RACES).map(([key, r]) => ({ key, label: r.label }));
  for (const [key, label] of Object.entries(SUBRACES)) opts.push({ key, label });
  return opts;
}

export function featureValueOptions() {
  return Object.entries(TARGET_FEATURES).map(([key, f]) => ({ key, label: f.label }));
}

export function patronValueOptions() {
  return [{ key: PATRON_ANY, label: "Любой покровитель" }, ...CHAOS_PATRONS.map(p => ({ key: p.key, label: p.label }))];
}

/** Собрать цель из вида+значения. Фракция сюда не входит — см. factionTarget(doc) напрямую, она приходит документом из Обозревателя. */
export function buildTarget(kind, value) {
  if (kind === "all") return allTarget();
  if (kind === "race") {
    const opt = raceValueOptions().find(o => o.key === value);
    return opt ? raceTarget(opt.key, opt.label) : null;
  }
  if (kind === "feature") return featureTarget(value);
  if (kind === "patron") {
    const opt = patronValueOptions().find(o => o.key === value);
    return opt ? patronTarget(opt.key, opt.label) : null;
  }
  return null;
}

/** HTML одной строки выбора цели — вид + зависимое значение. */
export function targetChoiceHtml(ch) {
  const kindOpts = TARGET_CHOICE_KINDS
    .map(k => `<option value="${k}">${esc(TARGET_KINDS[k])}</option>`).join("");
  return `<div class="hw-choice hw-target-choice">
    <div class="hw-choice-label">${esc(ch.label)}</div>
    <div class="hw-choice-hint">${esc(ch.hint || "")}</div>
    <select class="hw-target-kind" data-target-key="${esc(ch.key)}">${kindOpts}</select>
    <select class="hw-target-value" data-target-key="${esc(ch.key)}" style="display:none;"></select>
    <button type="button" class="hw-target-faction-btn" data-target-key="${esc(ch.key)}" style="display:none;">Выбрать фракцию…</button>
    <span class="hw-target-faction-label" data-target-key="${esc(ch.key)}"></span>
  </div>`;
}

/**
 * Оживляет строку внутри уже отрисованного jQuery-диалога: переключает
 * зависимый select по виду, зовёт Обозреватель для Фракции.
 * @param {JQuery} h        корень содержимого диалога
 * @param {object} ch       запись выбора (ключ/подсказка)
 * @param {object} state    { factionTargets: {} } — сюда кладётся цель-фракция
 *                          (async-результат Обозревателя, DOM его не хранит)
 * @param {(prompt:string) => Promise<string|null>} openBrowser  openCompendiumBrowser,
 *   передаётся снаружи — модуль сам Foundry-компендиумы не трогает
 */
export function wireTargetChoice(h, ch, state, openBrowser) {
  const kindSel     = h.find(`.hw-target-kind[data-target-key="${ch.key}"]`);
  const valueSel    = h.find(`.hw-target-value[data-target-key="${ch.key}"]`);
  const factionBtn  = h.find(`.hw-target-faction-btn[data-target-key="${ch.key}"]`);
  const factionLbl  = h.find(`.hw-target-faction-label[data-target-key="${ch.key}"]`);

  const fillValues = kind => {
    valueSel.empty().hide();
    factionBtn.hide();
    let opts = [];
    if (kind === "race") opts = raceValueOptions();
    else if (kind === "feature") opts = featureValueOptions();
    else if (kind === "patron") opts = patronValueOptions();
    else if (kind === "faction") { factionBtn.show(); return; }
    if (opts.length) {
      for (const o of opts) valueSel.append(`<option value="${esc(o.key)}">${esc(o.label)}</option>`);
      valueSel.show();
    }
  };

  // Строку рисуют заново при КАЖДОМ перерендере Мастера/листа (не только по
  // ответу на неё самоё — соседняя Раса персонажа тоже зовёт render), а
  // свежая HTML всегда начинается с «Фракция» по умолчанию. Без восстановления
  // ответ на эту строку тихо терялся при любом несвязанном клике рядом
  // (найдено живой проверкой: сменил Расу — Ненависть откатилась на Фракцию).
  const saved = state.lastPick?.[ch.key];
  if (saved) {
    kindSel.val(saved.kind);
    fillValues(saved.kind);
    if (saved.kind !== "faction") valueSel.val(saved.value);
  } else {
    fillValues(kindSel.val());
  }
  if (kindSel.val() === "faction" && state.factionTargets[ch.key]) factionLbl.text(state.factionTargets[ch.key].name);

  const remember = () => { (state.lastPick ??= {})[ch.key] = { kind: kindSel.val(), value: valueSel.val() }; };

  kindSel.on("change", () => {
    fillValues(kindSel.val());
    factionLbl.text("");
    delete state.factionTargets[ch.key];
    remember();
  });
  valueSel.on("change", remember);

  factionBtn.on("click", async ev => {
    ev.preventDefault();
    const uuid = await openBrowser(ch.hint || ch.label);
    if (!uuid) return;
    const doc = await fromUuid(uuid).catch(() => null);
    if (!doc) return;
    const target = factionTarget(doc);
    if (!target) { ui.notifications?.warn(`У фракции «${doc.name}» не задан ключ.`); return; }
    state.factionTargets[ch.key] = target;
    factionLbl.text(target.name);
    remember();
  });
}

/** Читает выбранную цель строки после закрытия диалога кнопкой «Принять». */
export function readTargetChoice(h, ch, state) {
  const kind = h.find(`.hw-target-kind[data-target-key="${ch.key}"]`).val();
  if (kind === "faction") return state.factionTargets?.[ch.key] || null;
  const value = h.find(`.hw-target-value[data-target-key="${ch.key}"]`).val();
  return buildTarget(kind, value);
}

/** Подпись цели для карточки/сводки — обёртка над targetLabel на случай null. */
export function targetChoiceLabel(target) {
  return target ? targetLabel(target) : "";
}

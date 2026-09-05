// module/rules/roll-mods.mjs
//
// Галочки от реестра правил — третий источник модификаторов рядом с
// Особенностями Происхождения и предметными rollMods. Правила приходят через
// конвейер теста (module/rules/resolve-test.mjs, фазы 1–3): здесь только показ.
//
// Формат записи тот же, {value, label, halvePenalty}, поэтому дальше диалог
// складывает все три вида галочек одинаково. Разметку читают и диалог броска
// навыка (на листе), и диалог атаки — поэтому она живёт отдельно от обоих.

import { resolveTest } from "./resolve-test.mjs";

/** Знак перед числом модификатора: «+10», «−10», пустая строка у нуля. */
const sgn = v => (v > 0 ? `+${v}` : (v < 0 ? `${v}` : ""));

/** Сумма автоматических модификаторов — то, что прибавляется к Порогу само. */
export function autoModsTotal(autoMods) {
  return (autoMods ?? []).reduce((sum, m) => sum + (Number(m.value) || 0), 0);
}

/**
 * Модификаторы теста для мест БЕЗ диалога с галочками — кнопок в карточке чата
 * и Реакций (Уклонение, Парирование, Страх, Захват, Паника). Спрашивать игрока
 * там негде: карточка уже отправлена, кнопка одна, и «поставьте галочку, если
 * считаете уместным» превратилось бы во второй диалог поверх боя.
 *
 * Поэтому здесь автоматические и «галочные» модификаторы складываются в одно
 * число, а игрок видит подписи в карточке результата — тот же неопросный
 * приём, каким уже сделано Карабканье (combat/movement-actions.mjs).
 *
 * @returns {{list: object[], total: number, parts: string[]}} parts — готовые
 *   строки для перечня модификаторов в карточке.
 */
export function collectTestMods(actor, context) {
  const { mods, autoMods } = resolveTest({ actor, ...context });
  const list = [...autoMods, ...mods];
  return {
    list,
    total: list.reduce((sum, m) => sum + (Number(m.value) || 0), 0),
    parts: list.map(m => `${m.label} ${sgn(m.value)}`)
  };
}

/**
 * Ситуативные штрафы состояния тела и снаряжения (wdbc-n17t) — строчный
 * список без галочек: игрок их не выбирает, они действуют, пока действует
 * само состояние. Раньше эти пять слагаемых просто молча уменьшали Порог, и
 * увидеть их можно было только в карточке после броска.
 *
 * Отдельный блок, а не строка в «Правилах»: там галочки, и поставить рядом
 * невыбираемую строку значило бы предложить игроку выбор, которого нет.
 */
export function ruleAutoModsHtml(actor, context, resolved = null) {
  const autoMods = (resolved ?? resolveTest({ actor, ...context })).autoMods ?? [];
  if (!autoMods.length) return { html: "", autoMods, total: 0 };
  const rows = autoMods.map(m =>
    `<div class="rule-auto-mod"><span>${m.label}</span><b>${sgn(m.value)}</b></div>`).join("");
  return {
    autoMods,
    total: autoModsTotal(autoMods),
    html: `<div class="atk-dlg-modifiers rule-auto-mods">
      <div class="atk-mods-title">Состояние (учтено в Пороге)</div>
      <div class="atk-mods-list">${rows}</div></div>`
  };
}

export function ruleRollModsHtml(actor, context, resolved = null) {
  // resolved — уже посчитанный resolveTest: избавляет вызывающего от
  // повторного обхода правил актора (attack-dialog зовёт трижды за диалог).
  const { mods } = resolved ?? resolveTest({ actor, ...context });
  if (!mods.length) return { html: "", mods };
  const rows = mods.map((m, i) => {
    const sign = m.value > 0 ? `+${m.value}` : (m.value < 0 ? `${m.value}` : "");
    return `<label class="attack-mod-check rule-roll-mod">
      <input type="checkbox" class="rule-mod" data-idx="${i}" data-value="${m.value || 0}"
             ${m.halvePenalty ? 'data-halve="1"' : ""}/>
      <span>${m.label}${sign ? ` <b>(${sign})</b>` : ""}</span></label>`;
  }).join("");
  return {
    mods,
    html: `<div class="atk-dlg-modifiers rule-mods">
      <div class="atk-mods-title">Правила</div>
      <div class="atk-mods-list">${rows}</div></div>`
  };
}

/**
 * Перебросы, доступные на этом тесте: Локусы Герольдов и всё, что книга даёт
 * тем же оборотом («раз в Раунд перебросить любой тест A»).
 *
 * Радиокнопки, а не галочки: два переброса на один бросок не складываются —
 * игрок выбирает, каким воспользоваться. «Без переброса» стоит по умолчанию,
 * потому что переброс почти всегда расходуемый: раз в Раунд, за Очко Бесчестия.
 *
 * Сколько перебросов уже потрачено за Раунд, здесь не считается: система не
 * ведёт учёт Раундов на акторе, и молчаливый счётчик соврал бы. Это остаётся
 * за столом, как и прежде.
 */
export function ruleRerollsHtml(actor, context, resolved = null) {
  // Только СВОИ перебросы: навязанные цели бросает она сама, у себя.
  const rerolls = ((resolved ?? resolveTest({ actor, ...context })).rerolls || []).filter(r => r.who !== "target");
  if (!rerolls.length) return { html: "", rerolls };
  const rows = rerolls.map((r, i) => `
    <label class="attack-mod-check rule-reroll">
      <input type="radio" name="rule-reroll" class="rule-reroll-opt" data-idx="${i}"
             data-mode="${r.mode}" data-rolls="${r.rolls}"/>
      <span>${r.label} <b>(${r.mode === "keepWorst" ? "худший" : "лучший"} из ${r.rolls})</b></span>
    </label>`).join("");
  return {
    rerolls,
    html: `<div class="atk-dlg-modifiers rule-rerolls">
      <div class="atk-mods-title">Перебросы</div>
      <div class="atk-mods-list">
        <label class="attack-mod-check rule-reroll">
          <input type="radio" name="rule-reroll" class="rule-reroll-opt" data-idx="-1" checked/>
          <span>без переброса</span>
        </label>${rows}</div></div>`
  };
}

// module/combat/cult-common.mjs
// ════════════════════════════════════════════════════════════════════════
//  Общие кирпичи кнопок пачки «культы» (Иерофант, Чумной Монах, Король
//  Червей, Скульптор Плоти, Когнитэ, Мейстер, Черты Пактов). Каждая кнопка
//  Таланта/Черты — книжная фраза «за N действий тест X: при Успехе …»;
//  здесь то, что у них одинаковое:
//
//    rollCultTest   — тест Навыка/Характеристики (или комбинированный — один
//                     бросок против меньшего Предела, rules/test-kind.mjs) с
//                     модификаторами реестра правил и карточкой в чат;
//    payActions     — цена в ОД (в бою с экономикой действий; вне боя — даром);
//    targetsOf      — выбранные цели (T) пользователя;
//    writeOrWarn    — правка ЧУЖОГО актора: свой/ГМ — пишет сам, иначе
//                     предупреждает (карточка уже назвала числа — ГМ внесёт);
//    askNumber/askChoice — короткие окна выбора;
//    cultCard       — карточка без броска.
//
//  Возврат помощников кнопок — соглашение item-script.mjs: истинное значение
//  (CANCEL) — «ничего не сделано», цена записи Конструктора не списывается.
// ════════════════════════════════════════════════════════════════════════

import { esc, _degWord } from "../helpers/utils.mjs";
import { postTestCard, rollStatLine, outcomeHtml } from "../helpers/test-card.mjs";
import { collectTestMods } from "../rules/roll-mods.mjs";
import { combinedThreshold } from "../rules/test-kind.mjs";
import { cultTestOutcome, cultTestLabel, cultTestBase } from "../rules/cult-tests.mjs";
import { canSpendActionPoints, spendActionPoints, isEncounterActive } from "./action-economy.mjs";

export const NS = "warhammer-dbc";
/** Возврат «отказ — цену не списывать». */
export const CANCEL = "cancel";

/** Акторы выбранных целей (T) пользователя. */
export function targetsOf() {
  return [...(globalThis.game?.user?.targets ?? [])].map(t => t?.actor).filter(Boolean);
}

/** Первая цель (T) или null. */
export function firstTarget() {
  return targetsOf()[0] ?? null;
}

/**
 * Цена в ОД: в бою — списывает (false — не хватило, предупреждение уже
 * показано), вне боя — бесплатно.
 */
export async function payActions(actor, cost, { physical = false, what = "" } = {}) {
  if (!cost || !isEncounterActive()) return true;
  if (!canSpendActionPoints(actor, cost, { physical })) {
    ui.notifications?.warn(`⚠️ ${actor?.name ?? ""}: ${what ? `${what} — ` : ""}не хватает Очков Действия (нужно ${cost}).`);
    return false;
  }
  return !!(await spendActionPoints(actor, cost, { physical }));
}

/** Правка чужого актора: свой или ГМ — пишет, иначе предупреждение. */
export async function writeOrWarn(target, update, what = "") {
  if (!target || !update || !Object.keys(update).length) return false;
  if (globalThis.game?.user?.isGM || target.isOwner) {
    await target.update(update);
    return true;
  }
  ui.notifications?.warn(`${esc(target.name)}: ${what || "правку"} внесёт ГМ — числа в карточке.`);
  return false;
}

/** Окно «число от min до max». null — отмена. */
export async function askNumber(title, label, { min = 0, max = 99, value = min, hint = "" } = {}) {
  const res = await foundry.applications.api.DialogV2.prompt({
    window: { title },
    content: `${hint ? `<p style="margin:4px 6px;">${hint}</p>` : ""}<div class="atk-dlg-row"><label>${esc(label)}</label>
      <input type="number" name="n" min="${min}" max="${max}" value="${value}" class="pm-input"/></div>`,
    ok: { label: "Применить", callback: (ev, button) => Number(button.form.elements.n.value) },
    rejectClose: false
  }).catch(() => null);
  if (res == null || !Number.isFinite(res)) return null;
  return Math.max(min, Math.min(max, Math.trunc(res)));
}

/**
 * Окно выбора из списка: options — [{ value, label }]. null — отмена.
 * `checks` — [{ name, label }] галочки под списком; при них возвращается
 * { value, checks: {name: bool} }.
 */
export async function askChoice(title, label, options, { hint = "", checks = null } = {}) {
  const opts = options.map(o => `<option value="${esc(o.value)}">${esc(o.label)}</option>`).join("");
  const boxes = (checks ?? []).map(c =>
    `<div class="atk-dlg-row"><label><input type="checkbox" name="${esc(c.name)}"/> ${esc(c.label)}</label></div>`).join("");
  return foundry.applications.api.DialogV2.prompt({
    window: { title },
    content: `${hint ? `<p style="margin:4px 6px;">${hint}</p>` : ""}<div class="atk-dlg-row"><label>${esc(label)}</label>
      <select name="choice" class="pm-input">${opts}</select></div>${boxes}`,
    ok: {
      label: "Применить",
      callback: (ev, button) => {
        const value = button.form.elements.choice.value;
        if (!checks) return value;
        const out = {};
        for (const c of checks) out[c.name] = !!button.form.elements[c.name]?.checked;
        return { value, checks: out };
      }
    },
    rejectClose: false
  }).catch(() => null);
}

/** Карточка без броска: заголовок и строки (HTML уже экранирован вызывающим). */
export async function cultCard(actor, title, lines, { icon = "🕯️" } = {}) {
  await postTestCard(actor, {
    icon, title: `${esc(title)} — ${esc(actor?.name ?? "")}`,
    lines: lines.filter(Boolean).map(l => `<div class="roll-threshold">${l}</div>`)
  }, { sound: false });
}

/**
 * Тест с карточкой. `tests` — одна или две части комбинированного теста:
 * { skill } | { group, spec, specLabel } | { char }, плюс { mod }.
 * `extraMod`/`extraLabel` — общая поправка (Ритуал Восьми Спиц и т.п.).
 * @returns {Promise<{success:boolean, deg:number, threshold:number, rv:number, roll:Roll}>}
 */
export async function rollCultTest(actor, {
  title, icon = "🎲", tests = [], extraMod = 0, extraLabel = "", success = "", failure = "", lines = [], targetActor = null
} = {}) {
  const parts = [];
  const bases = [];
  const thresholds = [];
  const labels = [];
  for (const t of tests) {
    const { base, char, skill, group } = cultTestBase(actor, t);
    const ctx = { kind: "skill", char, targetActor };
    if (skill) ctx.skill = skill;
    if (group) { ctx.group = group; ctx.specialty = t.specLabel ?? t.spec; }
    const rm = collectTestMods(actor, ctx);
    const mod = Number(t.mod) || 0;
    bases.push(base);
    if (tests.length === 1 && mod) parts.push(`${mod > 0 ? "+" : "−"}${Math.abs(mod)}`);
    thresholds.push(base + mod + rm.total + (Number(extraMod) || 0));
    labels.push(cultTestLabel(t));
    parts.push(...rm.parts.map(esc));
  }
  if (extraMod) parts.push(`${esc(extraLabel || "Поправка")} ${extraMod > 0 ? "+" : ""}${extraMod}`);
  const threshold = thresholds.length > 1 ? combinedThreshold(thresholds[0], thresholds[1]) : (thresholds[0] ?? 0);
  const roll = await new Roll("1d100").evaluate();
  const rv = roll.total;
  const { success: ok, deg } = cultTestOutcome(rv, threshold);
  await postTestCard(actor, {
    icon, title: `${esc(title)} — ${esc(actor?.name ?? "")}`,
    threshold: rollStatLine({
      label: labels.join(" + "),
      base: thresholds.length > 1 ? null : bases[0],
      parts: thresholds.length > 1 ? [...thresholds.map((v, i) => `${labels[i]}: ${v}`), ...parts] : parts,
      threshold, rv
    }),
    lines: lines.filter(Boolean).map(l => `<div class="roll-threshold">${l}</div>`),
    outcome: outcomeHtml(ok, ok
      ? `Успех — ${deg} ${_degWord(deg)}${success ? `. ${success}` : ""}`
      : `Провал — ${deg} ${_degWord(deg)}${failure ? `. ${failure}` : ""}`)
  }, { rolls: [roll] });
  return { success: ok, deg, threshold, rv, roll };
}

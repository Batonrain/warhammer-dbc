// module/combat/psyker-elite-common.mjs
// ════════════════════════════════════════════════════════════════════════
//  Общие кирпичи кнопок элитных архетипов-псайкеров (Архимаг, Дикий Псайкер,
//  Чернокнижник, Инзорцист, Кенетаи, Медуза): тест «Характеристика/Навык/
//  Порча ± N» одной карточкой, простые окна выбора и счётчики «до начала/
//  конца своего следующего Хода».
//
//  Тест здесь — тот же, что у прочих кнопок: Порог = база + поправка текста
//  + модификаторы реестра правил (collectTestMods), исход — общее ядро
//  rules/roll-outcome.mjs, карточка — helpers/test-card.mjs::postTestCard.
// ════════════════════════════════════════════════════════════════════════

import { esc, _degWord } from "../helpers/utils.mjs";
import { postTestCard, rollStatLine, outcomeHtml } from "../helpers/test-card.mjs";
import { collectTestMods } from "../rules/roll-mods.mjs";
import { testOutcome } from "../rules/roll-outcome.mjs";
import { rollD100WithReroll } from "../rules/test-kind-widget.mjs";
import { findGroupEntry } from "../constants/skill-specializations.mjs";
import { SKILLS_DEF } from "../constants/skills.mjs";
import { CHARACTERISTICS } from "../constants/characteristics.mjs";
import { measureTokens } from "./tactical-map.mjs";

const NS = "warhammer-dbc";

/**
 * База теста и модификаторы реестра.
 * what: { char } | { skill } | { group, spec } | { cor:true }
 * @returns {{base:number|null, label:string, mods:{total:number, parts:string[]}}}
 */
export function testBase(actor, what = {}) {
  if (what.cor) {
    return { base: Number(actor?.system?.corruption?.value) || 0, label: "Cor", mods: { total: 0, parts: [] } };
  }
  if (what.group) {
    const e = findGroupEntry(actor, what.group, what.spec);
    const en = SKILLS_DEF[what.group]?.en ?? what.group;
    const label = `${en} (${what.spec})`;
    const def = SKILLS_DEF[what.group];
    const mods = collectTestMods(actor, { kind: "skill", group: what.group, specialty: what.spec, char: def?.char });
    if (!e || e.total == null) {
      // Неизученное знание: Характеристика −20, если книга разрешает нетренированный тест.
      if (def?.cannotUntrained) return { base: null, label, mods };
      const c = Number(actor?.system?.characteristics?.[def?.char]?.total) || 0;
      return { base: c - 20, label, mods };
    }
    return { base: Number(e.total) || 0, label, mods };
  }
  if (what.skill) {
    const def = SKILLS_DEF[what.skill];
    const sk = actor?.system?.skills?.[what.skill];
    const base = sk?.total != null ? Number(sk.total) || 0 : (Number(actor?.system?.characteristics?.[def?.char]?.total) || 0) - 20;
    const mods = collectTestMods(actor, { kind: "skill", skill: what.skill, char: def?.char });
    return { base, label: def?.en ?? what.skill, mods };
  }
  const key = what.char ?? "wp";
  return {
    base: Number(actor?.system?.characteristics?.[key]?.total) || 0,
    label: CHARACTERISTICS[key]?.abbr ?? key,
    mods: collectTestMods(actor, { kind: "skill", char: key })
  };
}

const sgn = n => `${n < 0 ? "−" : "+"}${Math.abs(n)}`;

/**
 * Тест одной карточкой.
 * @param {Actor} actor
 * @param {object} o
 * @param {object} o.what      см. testBase
 * @param {number} [o.mod=0]   поправка из текста
 * @param {string[]} [o.extraParts] подписи доп. поправок (уже в mod)
 * @param {boolean} [o.advantage] Преимущество: два броска, лучший
 * @param {string} o.title
 * @param {string} [o.icon]
 * @param {string|function} [o.success] строка исхода при Успехе (или (deg)=>строка)
 * @param {string|function} [o.failure]
 * @param {string[]} [o.lines] доп. строки карточки (HTML)
 * @param {boolean} [o.post=true] писать ли карточку
 * @returns {Promise<{ok:boolean, success:boolean, deg:number, threshold:number, rv:number, rolls:Roll[]}>}
 */
export async function eliteTest(actor, {
  what = {}, mod = 0, extraParts = [], advantage = false, title = "Тест", icon = "🎲",
  success = "", failure = "", lines = [], post = true
} = {}) {
  const { base, label, mods } = testBase(actor, what);
  if (base == null) {
    ui.notifications?.warn(`⚠️ ${actor?.name ?? ""}: нет Навыка ${label} — тест невозможен.`);
    return { ok: false, success: false, deg: 0, threshold: 0, rv: 0, rolls: [] };
  }
  const m = Number(mod) || 0;
  const threshold = base + m + mods.total;
  const reroll = advantage ? { rolls: 2, mode: "keepBest", label: "Преимущество" } : null;
  const { rv, rolls, rerollNote } = await rollD100WithReroll(reroll);
  const { success: ok, deg } = testOutcome(rv, threshold);
  const pick = (v, d) => (typeof v === "function" ? v(d) : v);
  const tail = ok ? pick(success, deg) : pick(failure, deg);
  if (post) {
    await postTestCard(actor, {
      icon, title: `${esc(title)} — ${esc(actor?.name ?? "")}`,
      threshold: rollStatLine({ label: `${label}${sgn(m)}`, base, parts: [m ? sgn(m) : null, ...extraParts, ...mods.parts], threshold, rv }),
      rerollNote,
      lines,
      outcome: outcomeHtml(ok, `${ok ? "Успех" : "Провал"} — ${deg} ${_degWord(deg)}${tail ? `. ${tail}` : ""}`)
    }, { rolls });
  }
  return { ok: true, success: ok, deg, threshold, rv, rolls };
}

/** Окно «введите число» → число или null (отмена). */
export function askNumber(title, label, value = 0, { min = 0, max = 999, hint = "" } = {}) {
  return foundry.applications.api.DialogV2.prompt({
    window: { title },
    content: `<div class="atk-dlg-row"><label>${esc(label)}:</label><input type="number" name="n" class="pm-input" value="${Number(value) || 0}" min="${min}" max="${max}"/></div>${hint ? `<p class="dyn-hint">${hint}</p>` : ""}`,
    ok: { label: "Готово", callback: (event, button) => Number(button.form.elements.n.value) },
    rejectClose: false
  }).then(v => (v == null || !Number.isFinite(v) ? null : Math.max(min, Math.min(max, Math.trunc(v))))).catch(() => null);
}

/** Окно выбора из списка → value или null. */
export function askSelect(title, label, options, { hint = "", ok = "Выбрать" } = {}) {
  if (!options?.length) return Promise.resolve(null);
  return foundry.applications.api.DialogV2.prompt({
    window: { title },
    content: `<div class="atk-dlg-row"><label>${esc(label)}:</label><select name="pick" class="pm-input">${options.map(o =>
      `<option value="${esc(o.value)}">${esc(o.label)}</option>`).join("")}</select></div>${hint ? `<p class="dyn-hint">${hint}</p>` : ""}`,
    ok: { label: ok, callback: (event, button) => button.form.elements.pick.value },
    rejectClose: false
  }).catch(() => null);
}

/** Окно «да/нет». */
export function askConfirm(title, html, yes = "Да", no = "Нет") {
  return foundry.applications.api.DialogV2.confirm({
    window: { title }, content: `<p>${html}</p>`, yes: { label: yes }, no: { label: no }, rejectClose: false
  }).then(r => !!r).catch(() => false);
}

/** Окно с галочками → массив выбранных value или null. */
export function askChecks(title, options, { hint = "", ok = "Готово" } = {}) {
  return foundry.applications.api.DialogV2.prompt({
    window: { title },
    content: `${options.map((o, i) => `<div class="atk-dlg-row"><label><input type="checkbox" name="c${i}" ${o.checked ? "checked" : ""}/> ${esc(o.label)}</label></div>`).join("")}${hint ? `<p class="dyn-hint">${hint}</p>` : ""}`,
    ok: { label: ok, callback: (event, button) => options.filter((o, i) => button.form.elements[`c${i}`]?.checked).map(o => o.value) },
    rejectClose: false
  }).catch(() => null);
}

/** Простая карточка без броска. */
export async function infoCard(actor, title, lines, { icon = "✦", rolls = [] } = {}) {
  return postTestCard(actor, { icon, title: `${esc(title)} — ${esc(actor?.name ?? "")}`, lines }, { rolls, sound: false });
}

// ── Счётчики «до начала / до конца своего следующего Хода» ────────────────
//  Число в флаге актора уменьшается в начале каждого его Хода (tickTurnFlags);
//  на нуле метка снята. «До начала следующего» — 1, «до конца следующего» — 2
//  (и в свой Ход, и в чужой: следующий свой Ход ещё впереди).

/** Поставить метку на n начал Хода. */
export async function setTurnFlag(actor, flag, turns) {
  await actor.setFlag(NS, flag, Math.max(1, Math.trunc(Number(turns) || 1)));
}

/** Начало Хода актора: уменьшить метки; вернуть те, что погасли. */
export async function tickTurnFlags(actor, flags) {
  const gone = [];
  const upd = {};
  for (const f of flags) {
    const v = Number(actor?.getFlag?.(NS, f)) || 0;
    if (v <= 0) continue;
    if (v <= 1) { upd[`flags.${NS}.-=${f}`] = null; gone.push(f); }
    else upd[`flags.${NS}.${f}`] = v - 1;
  }
  if (Object.keys(upd).length) await actor.update(upd);
  return gone;
}

/** Расстояние между токенами двух акторов в метрах (край—край), null — нет токенов. */
export function actorsDistance(a, b) {
  const ta = a?.getActiveTokens?.(false)?.[0] ?? null;
  const tb = b?.getActiveTokens?.(false)?.[0] ?? null;
  if (!ta || !tb) return null;
  return measureTokens(ta, tb)?.edgeM ?? null;
}

/** Выбранные игроком цели (T) → акторы. */
export function targetedActors() {
  return [...(globalThis.game?.user?.targets ?? [])].map(t => t.actor).filter(Boolean);
}

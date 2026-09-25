// module/combat/char-damage-button.mjs
// ════════════════════════════════════════════════════════════════════════════
//  КНОПКА «УРОН В ХАРАКТЕРИСТИКУ» — для крит-строк и психосил.
//
//  Крит-таблицы (task-174e) пишут «Цель получает 1d10 урона в T», «1d5 урона
//  в WS и BS», «2d10 урона в S, T и A», «1 перманентного урона в I» — раньше
//  только текстом в чате. Психосилы с полем «Урон по характеристике»
//  (task-5820) тоже выводили число текстом «примените к цели сами».
//
//  Одна кнопка на оба случая: формула или готовое число, одна или несколько
//  Характеристик (кубик бросается ОДИН раз и ложится в каждую названную —
//  «1d10 урона в WS и BS» — один бросок), цель — актор карточки, если он
//  известен (крит), иначе выделенный токен (психосила). Урон — единой точкой
//  combat/char-damage.mjs::applyCharDamage (пол 0, T = 0 — смерть);
//  «перманентный» — порцией без восстановления (rules/char-loss.mjs, task 1-8).
//
//  Обороты сверены по всем 27 строкам critical-tables.mjs с уроном в
//  Характеристику (25.09.2026). Кириллица в регэкспах — явными классами, без \b.
// ════════════════════════════════════════════════════════════════════════════

import { applyCharDamage } from "./char-damage.mjs";
import { CHARACTERISTICS } from "../constants/characteristics.mjs";
import { esc } from "../helpers/utils.mjs";

/** Сокращения книги → ключи Характеристик. */
export const BOOK_CHAR_ABBR = {
  WS: "ws", BS: "bs", S: "s", T: "t", A: "ag", AG: "ag",
  I: "int", INT: "int", P: "per", PER: "per", W: "wp", WP: "wp", F: "fel", FEL: "fel"
};

/**
 * Урон в Характеристики из текста крит-строки.
 * @returns {{formula:string, keys:string[], permanent:boolean}[]}
 */
export function parseCritCharDamage(text) {
  const out = [];
  if (!text) return out;
  const re = /(\d+d\d+|\d+)\s+(перманентного\s+)?урона\s+в\s+([A-Za-z]+(?:(?:,\s*|\s+и\s+)[A-Za-z]+)*)/gu;
  for (const m of String(text).matchAll(re)) {
    const keys = m[3].split(/,\s*|\s+и\s+/u)
      .map(a => BOOK_CHAR_ABBR[a.toUpperCase()]).filter(Boolean);
    if (keys.length) out.push({ formula: m[1], keys: [...new Set(keys)], permanent: !!m[2] });
  }
  return out;
}

/** Подпись Характеристик кнопки: «WS и BS». */
function keysLabel(keys) {
  return keys.map(k => CHARACTERISTICS[k]?.abbr || k.toUpperCase()).join(" и ");
}

/**
 * HTML кнопки. actorUuid пуст — урон ляжет на выделенный токен.
 * @param {{formula?:string, amount?:number, keys:string[], permanent?:boolean}} e
 */
export function charDamageButtonHtml(e, { actorUuid = "", source = "" } = {}) {
  if (!e?.keys?.length) return "";
  const what = e.amount != null ? String(e.amount) : e.formula;
  const perm = e.permanent ? " (перманентно)" : "";
  return `<button type="button" class="wh-char-dmg-btn" data-actor-uuid="${esc(actorUuid)}"
    data-keys="${e.keys.join(",")}" data-formula="${esc(e.formula || "")}"
    data-amount="${e.amount != null ? Number(e.amount) : ""}" data-permanent="${e.permanent ? 1 : 0}"
    data-source="${esc(source)}"
    title="${actorUuid ? "Нанести цели карточки" : "Нанести выделенному токену"}">
    🩸 Урон ${esc(what)} в ${esc(keysLabel(e.keys))}${perm}</button>`;
}

/** Блок кнопок по крит-строке — пусто, если урона в Характеристики в ней нет. */
export function critCharDamageHtml(text, actorUuid) {
  const btns = parseCritCharDamage(text)
    .map(e => charDamageButtonHtml(e, { actorUuid, source: "Критический Эффект" })).join("");
  return btns ? `<div class="wh-crit-pills">${btns}</div>` : "";
}

/**
 * Применить урон по данным кнопки к актору и сказать об этом в чате.
 * @returns {Promise<?{amount:number, results:object[]}>}
 */
export async function applyCharDamageButton(actor, { keys = [], formula = "", amount = null, permanent = false, source = "" } = {}) {
  if (!actor || !keys.length) return null;
  let value = Number(amount);
  let roll = null;
  if (amount == null || amount === "" || !Number.isFinite(value)) {
    roll = await new Roll(String(formula || "0")).evaluate();
    value = roll.total;
  }
  const portion = permanent ? { hours: 0, source: source || "перманентный урон" } : null;
  const results = [];
  for (const key of keys) {
    const r = await applyCharDamage(actor, key, value, { portion });
    results.push({ key, ...r });
  }
  const lines = results.map(r => `${esc(CHARACTERISTICS[r.key]?.label || r.key)}: <b>${r.before}</b> → <b>${r.after}</b>${r.died ? " — <b>смерть</b>" : ""}`);
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="wh-roll-result">
      <div class="roll-header">🩸 Урон в Характеристики → ${esc(actor.name)}</div>
      <div class="roll-threshold">${roll ? `${esc(formula)} = ` : ""}<b>${value}</b>${permanent ? " · перманентный — не восстанавливается" : ""}${source ? ` · ${esc(source)}` : ""}</div>
      ${lines.map(l => `<div class="roll-threshold">${l}</div>`).join("")}
    </div>`,
    rolls: roll ? [roll] : []
  });
  return { amount: value, results };
}

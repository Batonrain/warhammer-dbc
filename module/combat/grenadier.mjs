// module/combat/grenadier.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Grenadier / Гренадер — кнопки на строке смещения промахнувшейся гранаты
//  (combat/attack-card.mjs, notes.blastScatter.grenadier; правила и чистые
//  функции — rules/throwing-talents.mjs, Sahara 3-8318):
//    • «уменьшить смещение на BS.b» — один раз на карточку;
//    • «перебросить направление» — d8 по розе (combat/scatter.mjs), один раз.
//  Правка идёт в разметку карточки у нажавшего (как «Искры»), а результат
//  дублируется короткой строкой в чат, чтобы стол видел новое смещение.
//  «Не задел врагов / задел союзников» решает игрок — у смещённого взрыва в
//  системе нет списка накрытых целей.
// ════════════════════════════════════════════════════════════════════════════

import { SCATTER_ROSE } from "./scatter.mjs";
import { reducedScatterDistance } from "../rules/throwing-talents.mjs";
import { esc } from "../helpers/utils.mjs";

const NS = "warhammer-dbc";
/** Флаг сообщения: исправленное смещение { dist, dirLabel, dirIcon } — переживает перерисовку карточки. */
export const SCATTER_FLAG = "grenadierScatter";

/**
 * Наложить сохранённое смещение на разметку карточки. Нужно потому, что отметка «раз на карточку»
 * (card-once.mjs) пишет флаг на сообщение и тем перерисовывает карточку из исходного content —
 * без этого исправленные дистанция и направление пропадали бы сразу после нажатия.
 */
export function applyScatterOverride(root, saved) {
  if (!saved || !root?.querySelector) return;
  if (saved.dist != null) { const el = root.querySelector(".wh-scatter-dist"); if (el) el.textContent = String(saved.dist); }
  if (saved.dirLabel != null) { const el = root.querySelector(".wh-scatter-dir"); if (el) el.textContent = saved.dirLabel; }
  if (saved.dirIcon != null) { const el = root.querySelector(".wh-scatter-dir-icon"); if (el) el.textContent = saved.dirIcon; }
}

/** Записать исправленное смещение в сообщение (автору/ГМу; чужому клиенту — только DOM, как раньше). */
export async function persistScatter(message, patch) {
  if (!message?.update || message.isOwner === false) return false;
  const data = {};
  for (const [k, v] of Object.entries(patch)) data[`flags.${NS}.${SCATTER_FLAG}.${k}`] = v;
  await message.update(data);
  return true;
}

const say = html => ChatMessage.create({
  speaker: ChatMessage.getSpeaker?.() ?? {},
  content: `<div class="wh-roll-result"><div class="roll-outcome">${html}</div></div>`
});

/**
 * @param {{distEl:{textContent:string}}} note  элементы строки смещения
 * @param {number} reduce  BS.b
 * @returns {Promise<{from:number,to:number}>}
 */
export async function grenadierReduceScatter(note, reduce) {
  const from = parseInt(note.distEl?.textContent, 10) || 0;
  const to = reducedScatterDistance(from, reduce);
  if (note.distEl) note.distEl.textContent = String(to);
  await say(`🎯 Гренадер: смещение гранаты ${from} м → <b>${to} м</b> (−${esc(reduce)} = BS.b).`);
  return { from, to };
}

/**
 * Перебросить направление смещения (d8). Бросок выполняет вызывающий слой (Roll Foundry),
 * чтобы карточка и тест делили один источник кубов.
 * @returns {Promise<{dir:object, roll:Roll}>}
 */
export async function grenadierRerollDirection(note) {
  const roll = await new Roll("1d8").evaluate();
  const dir = SCATTER_ROSE[roll.total - 1];
  if (note.dirEl) note.dirEl.textContent = dir.label;
  if (note.iconEl) note.iconEl.textContent = dir.icon;
  await say(`🎲 Гренадер: направление смещения перебросили (d8 = ${roll.total}) — ${dir.icon} <b>${esc(dir.label)}</b> (${dir.n}/8).`);
  return { dir, roll };
}

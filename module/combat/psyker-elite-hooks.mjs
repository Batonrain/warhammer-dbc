// module/combat/psyker-elite-hooks.mjs
// ════════════════════════════════════════════════════════════════════════
//  Точки окна манифестации (sheets/tabs/psychic.mjs::executePsychotest) для
//  Черт и Талантов элитных архетипов-псайкеров. В psychic.mjs — по одной
//  короткой строке на точку, вся логика здесь:
//
//   eliteManifestGate   — до любых трат: можно ли вообще (Тёмные Искусства)
//   eliteManifestEpr    — к эPR и Порогу (Пламя Сердца, Мощь Переполняет,
//                          Чародейский Посох)
//   eliteManifestRoll   — после броска психотеста (Варп-Танцор: второй
//                          бросок A, берётся худший)
//   eliteExtraPeril     — Прорыв сверх обычного (Мощь Переполняет)
//   eliteManifestAfter  — строки карточки после исхода (Высший Магус,
//                          Последнее Эхо, Маг-Каннибал)
//
//  Отложенное «до следующей манифестации» — combat/psyker-elite-hooks-state.mjs.
//  Переброс психотеста (Ключевые Силы) повторяет opts первой попытки: взятое
//  из отложенного кладётся в opts.eliteBoost и при перебросе не берётся заново.
// ════════════════════════════════════════════════════════════════════════

import { esc } from "../helpers/utils.mjs";
import { rollPeril } from "./rubric-sorcerer.mjs";
import { getPeril } from "../constants/psyker-tables.mjs";
import { takePendingManifest } from "./psyker-elite-hooks-state.mjs";
import { wizardStaffTestBonus } from "./archmagus.mjs";
import { hasMagusSupreme } from "../rules/archmagus-talents.mjs";
import { darkArtsGate, warpDanceOutcome } from "../rules/warlock-talents.mjs";
import { warlockAfterManifest } from "./warlock.mjs";
import { testOutcome } from "../rules/roll-outcome.mjs";

const small = (html, color = "") => `<div class="roll-threshold" style="font-size:0.85em;${color ? `color:${color};` : ""}">${html}</div>`;

/** Отказ манифестации (строка причины) или "". */
export function eliteManifestGate(actor, item, opts, { mPR = 0 } = {}) {
  void mPR;
  // Тёмные Искусства (Чернокнижник): только Пути Силы и Обычный режим; Варп-Танцор —
  // без Пути и реакции двумя бросками (метка opts.warpDance для eliteManifestRoll).
  const g = darkArtsGate(actor, { path: opts.path || "", mode: opts.mode || "normal", action: item?.system?.action });
  if (!g.ok) return g.reason;
  opts.warpDance = g.warpDance;
  return "";
}

/**
 * эPR и поправка Порога от отложенного. Возвращает новый эPR; поправку
 * Порога кладёт в opts.modifier (её видно в карточке строкой «Модификатор»).
 */
export async function eliteManifestEpr(actor, item, opts, ePR, lines) {
  const boost = opts.reroll ? (opts.eliteBoost ?? {}) : await takePendingManifest(actor);
  if (!opts.reroll) opts.eliteBoost = boost;
  let e = ePR;
  const hf = Number(boost.heartFire) || 0;
  if (hf > 0) {
    e += hf;
    lines.push(small(`Пламя Сердца: +${hf} к эPR (кубик уже брошен кнопкой Таланта, урон в T и S нанесён).`));
  }
  if (boost.overwhelming) {
    lines.push(small(`Мощь Переполняет: эPR ${e} ×2 = <b>${e * 2}</b>; Варп-Прорыв будет вызван сверх обычных Феноменов.`, "#a33"));
    e *= 2;
  }
  // Чародейский Посох: тип Физическое (кнопка Черты) и Good.Q/Best.Q посоха — к Порогу.
  // При перебросе opts.modifier уже несёт эти прибавки первой попытки.
  if (!opts.reroll) {
    const staffPhys = Number(boost.staff) || 0;
    const { bonus: staffQ, staff } = wizardStaffTestBonus(actor);
    const add = staffPhys + staffQ;
    if (add) {
      opts.modifier = (Number(opts.modifier) || 0) + add;
      lines.push(small(`Чародейский Посох: +${add} к психотесту${staffPhys ? ` (тип Физическое +${staffPhys}, не меньше полудействия)` : ""}${staffQ ? ` (${esc(staff.name)}, качество +${staffQ})` : ""} — в «Модификаторе».`));
    }
  }
  return e;
}

/** После броска психотеста: возможно, другой исход. */
export async function eliteManifestRoll(actor, item, opts, res, lines, rolls) {
  if (!opts.warpDance) return { success: res.success, deg: res.deg };
  // Варп-Танцор: второй бросок — A вместо Характеристики силы, те же поправки Порога.
  const ag = Number(actor?.system?.characteristics?.ag?.total) || 0;
  const agThreshold = (Number(res.threshold) || 0) - (Number(res.charVal) || 0) + ag;
  const roll = await new Roll("1d100").evaluate();
  rolls.push(roll);
  const agRes = testOutcome(roll.total, agThreshold);
  const out = warpDanceOutcome({ success: res.success, deg: res.deg }, agRes);
  lines.push(small(`Варп-Танцор: сила получает тип <b>Физическое</b>; второй бросок A — ${roll.total} против ${agThreshold}: ${agRes.success ? "успех" : "провал"} (${agRes.deg}). Берётся худший: <b>${out.success ? `успех, ${out.deg}` : `провал, ${out.deg}`}</b>. Дубли на A Феноменов не вызывают.`));
  return out;
}

/** Прорыв сверх обычного (HTML) или "". */
export async function eliteExtraPeril(actor, opts, allRolls) {
  if (!opts?.eliteBoost?.overwhelming) return "";
  const perilRoll = await rollPeril(actor, allRolls);
  const peril = getPeril(perilRoll.total);
  return `
        <div class="psy-peril">
          <div class="psy-peril-header">💀 ВАРП-ПРОРЫВ! Мощь Переполняет (бросок ${perilRoll.total})${perilRoll.note}</div>
          <div class="psy-peril-name">${peril.label}</div>
          <div class="psy-peril-text">${peril.text}</div>
        </div>`;
}

/** Строки карточки после исхода (и побочные метки). */
export async function eliteManifestAfter(actor, item, opts, { success = false, phenomena = false, perilTriggered = false } = {}) {
  const out = [];
  // Чернокнижник: Последнее Эхо после Жертвы, Маг-Каннибал прерывается Феноменом.
  out.push(...await warlockAfterManifest(actor, { path: opts.path || "", phenomena, perilTriggered, reroll: !!opts.reroll }));
  if (phenomena && hasMagusSupreme(actor)) {
    out.push(small("Высший Магус: этот Феномен (не Прорыв) <b>не действует на самого Архимага</b>, на остальных — как обычно. Исключить союзников (1 Очко Бесчестия) или перенести Прорыв (3 Очка) — кнопкой Черты.", "#5a4a30"));
  }
  const ow = Number(opts?.eliteBoost?.overwhelming) || 0;
  if (ow && success && item?.system?.sustainable) {
    out.push(small(`Мощь Переполняет: если «${esc(item.name)}» поддерживается — она развеется сама через ${ow} Ходов (W.b).`, "#a33"));
  }
  return out;
}

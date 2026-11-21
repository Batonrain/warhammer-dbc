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

const small = (html, color = "") => `<div class="roll-threshold" style="font-size:0.85em;${color ? `color:${color};` : ""}">${html}</div>`;

/** Отказ манифестации (строка причины) или "". */
export function eliteManifestGate(actor, item, opts, { mPR = 0 } = {}) {
  void actor; void item; void opts; void mPR;
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
  return e;
}

/** После броска психотеста: возможно, другой исход. */
export async function eliteManifestRoll(actor, item, opts, res, lines, rolls) {
  void item; void opts; void lines; void rolls; void actor;
  return res;
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
export async function eliteManifestAfter(actor, item, opts, { success = false } = {}) {
  const out = [];
  const ow = Number(opts?.eliteBoost?.overwhelming) || 0;
  if (ow && success && item?.system?.sustainable) {
    out.push(small(`Мощь Переполняет: если «${esc(item.name)}» поддерживается — она развеется сама через ${ow} Ходов (W.b).`, "#a33"));
  }
  return out;
}

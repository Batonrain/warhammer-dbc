// module/combat/drug-withdrawal.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Foundry-обвязка зависимости от наркотика: состояние «когда была последняя
//  доза» и часы Календаря (wdbc-gyqf2). Арифметика, книжный текст и допущения —
//  rules/drug-withdrawal.mjs.
//
//   • доза принята → startWithdrawal: штраф снят, отсчёт частоты с нуля;
//   • часы Календаря (CONDITION_CLOCK_HANDLERS, combat/condition-clock.mjs):
//     на каждой границе «последняя доза + N × частота» — карточка в чат (штраф
//     включился / открыт тест на срыв) и урон в Характеристику «в начале каждого
//     периода» (Тиск, Сатрофин);
//   • сам штраф к броскам — не здесь: источник правил «drugWithdrawal»
//     (rules/sources.mjs), читает то же состояние.
//
//  Паттерн — Крючок Сывороток (combat/replicant.mjs::serumHookClock): метка
//  «нанесено до» ставится ДО урона, откат Календаря ничего не копит и не бьёт
//  дважды, а метки дозы нет — отсчёт начинается с этого отрезка (штрафа задним
//  числом нет: зависимость, поставленная до появления часов, не наказывается
//  за прошлое).
// ════════════════════════════════════════════════════════════════════════════

import { applyCharDamage } from "./char-damage.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { CHARACTERISTICS } from "../constants/characteristics.mjs";
import { esc } from "../helpers/utils.mjs";
import {
  WITHDRAWAL_FLAG, addictedDrugs, drugKey, parseFrequency, periodBoundaries, freshEntry,
  readWithdrawalEntries, breakTestMod, parsePenaltyMods, formatMod
} from "../rules/drug-withdrawal.mjs";

const NS = "warhammer-dbc";

/** Доза принята (или зависимость только что возникла): отсчёт частоты приёма с нуля. */
export async function startWithdrawal(actor, item, now = globalThis.game?.time?.worldTime ?? 0) {
  if (!actor?.setFlag) return;
  try { await actor.setFlag(NS, WITHDRAWAL_FLAG, { [drugKey(item)]: freshEntry(now) }); }
  catch (e) { console.warn("warhammer-dbc | зависимость: не записать отсчёт частоты приёма", e); }
}

/** Зависимость снята: запись не нужна. null (а не удаление ключа) — setFlag сливает объекты. */
export async function endWithdrawal(actor, item) {
  if (!actor?.setFlag || readWithdrawalEntries(actor)[drugKey(item)] == null) return;
  // Вторая зависимая стопка того же препарата ещё держит счёт (запись общая по названию).
  if (addictedDrugs(actor.items).some(i => i.id !== item.id && drugKey(i) === drugKey(item))) return;
  try { await actor.setFlag(NS, WITHDRAWAL_FLAG, { [drugKey(item)]: null }); }
  catch (e) { console.warn("warhammer-dbc | зависимость: не снять отсчёт", e); }
}

/** За закончившийся период пробовали сорвать зависимость — второй попытки на тот же период нет. */
export async function markBreakTested(actor, item, completed) {
  const e = readWithdrawalEntries(actor)[drugKey(item)];
  if (!e || !actor?.setFlag) return;
  await actor.setFlag(NS, WITHDRAWAL_FLAG, { [drugKey(item)]: { ...e, tested: Number(completed) || 0 } });
}

async function chat(actor, header, body, rolls = []) {
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="wh-roll-result">
      <div class="roll-header">${header}</div>
      ${body}
    </div>`,
    rolls,
    sound: rolls.length ? CONFIG.sounds.dice : null
  });
}

/**
 * Часы зависимости — обработчик CONDITION_CLOCK_HANDLERS. По каждому зависимому
 * препарату наверстывает ВСЕ границы периодов в отрезке (прыжок Календаря на
 * недели — несколько периодов, а не один).
 */
export async function drugWithdrawalClock(actor, { from, to }) {
  const drugs = addictedDrugs(actor.items);
  if (!drugs.length) return;
  const entries = readWithdrawalEntries(actor);
  const seen = new Set();
  for (const item of drugs) {
    const key = drugKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    const add = item.system.addiction;
    const period = parseFrequency(add.frequency);
    if (!period) continue;
    const entry = entries[key];
    if (!entry) {
      // Метки дозы нет (зависимость поставлена до часов или вручную): отсчёт — с
      // КОНЦА этого отрезка. С начала нельзя: после большого сдвига Календаря
      // штраф включился бы задним числом, а тест на срыв сразу открылся бы с
      // бонусом +10 за каждый «прожитый» период (ревью wdbc-gyqf2).
      await startWithdrawal(actor, item, Number(to));
      continue;
    }
    // Бьют только границы позже метки «обработано до»: откат Календаря ничего не
    // снимает и не копит, повторный сдвиг вперёд не повторяет карточку и урон.
    const bounds = periodBoundaries(entry, period, Math.max(Number(from), Number(entry.doneTo) || 0), to);
    if (!bounds.length) continue;
    await actor.setFlag(NS, WITHDRAWAL_FLAG, { [key]: { ...entry, doneTo: Number(to) } });

    const lines = [];
    const rolls = [];
    const dmg = add.periodCharDamage;
    for (const b of bounds) {
      if (actor.getFlag?.(NS, "deceased")) break;
      if (b.index === 1) {
        const mods = parsePenaltyMods(add.penaltyMods).mods;
        lines.push(`Доза просрочена (частота приёма — ${esc(add.frequency)}): начался штраф зависимости${add.penalty ? ` — ${esc(add.penalty)}` : ""}.${mods.length ? " Модификаторы теста применяются к броскам сами." : ""}`);
      } else {
        const mod = breakTestMod(b.index - 1, add.breakMod);
        lines.push(`${b.index - 1}-й период под штрафом закончился — можно пройти тест на срыв зависимости: <b>${formatMod(mod)}</b> (кнопка «Тест» в панели ЗАВИСИМОСТИ).`);
      }
      if (dmg?.stat && dmg?.formula) {
        const roll = await new Roll(dmg.formula).evaluate();
        rolls.push(roll);
        const res = await applyCharDamage(actor, dmg.stat, Math.max(0, roll.total), { at: b.at });
        const abbr = CHARACTERISTICS[dmg.stat]?.abbr ?? dmg.stat.toUpperCase();
        lines.push(`В начале периода: ${dmg.formula} = ${roll.total} → урон в ${abbr} −${res.applied}${res.decay ? ` (с Генетическим Угасанием)` : ""}.`);
        if (res.died) break;
      }
    }
    if (!lines.length) continue;
    await chat(actor, `${rollIcon("warn", "#d9a066")}${esc(actor.name)} — зависимость: ${esc(item.name)}`,
      lines.map(l => `<div class="roll-threshold">${l}</div>`).join(""), rolls);
  }
}

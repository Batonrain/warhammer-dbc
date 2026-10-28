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
import { DISORDER_LIBRARY } from "../constants/fear-tables.mjs";
import { esc } from "../helpers/utils.mjs";
import {
  WITHDRAWAL_FLAG, addictionRecords, addictionSnapshot, drugKey, parseFrequency, periodBoundaries, freshEntry,
  readWithdrawalEntries, breakTestMod, parsePenaltyMods, formatMod, withdrawalDisorders
} from "../rules/drug-withdrawal.mjs";

const NS = "warhammer-dbc";
/** Флаг предмета-расстройства, выданного зависимостью: ключ препарата. По нему расстройство и снимается. */
export const WITHDRAWAL_DISORDER_FLAG = "withdrawalDisorder";

/**
 * Флаг СВОЕГО предмета-расстройства игрока, тяжесть которого зависимость подняла: { key, from, applied } —
 * ключ препарата, исходная тяжесть, тяжесть после прибавки. Запоминается при выдаче, а не пересчитывается.
 */
export const WITHDRAWAL_BOOST_FLAG = "withdrawalBoost";

const flagOf = (i, key) => i?.getFlag?.(NS, key) ?? i?.flags?.[NS]?.[key];
const isMine = i => i?.type === "mentalDisorder" && !!flagOf(i, WITHDRAWAL_DISORDER_FLAG);
const SEV_MIN = -5, SEV_MAX = 5;
const clampSeverity = n => Math.max(SEV_MIN, Math.min(SEV_MAX, Math.trunc(Number(n) || 0)));

/**
 * Привести расстройства зависимости в соответствие с её состоянием (Психический Вампир: «Агрессия» тяжести 2
 * — сразу при возникновении зависимости и до срыва; решение владельца 27.10.2026). Идемпотентно — зовётся из
 * часов Календаря, при приёме дозы, при возникновении и снятии зависимости, повторный вызов ничего не плодит.
 *  • нет такого расстройства у персонажа — выдаётся обычное (sheets/tabs/disorders.mjs::createDisorderItem),
 *    помеченное ключом препарата; зависимости нет — снимается только такое, помеченное;
 *  • есть СВОЁ расстройство с этим названием — не дублируется и не удаляется: его тяжесть поднимается на
 *    тяжесть штрафа (с обрезкой по потолку), исходная тяжесть пишется во флаг withdrawalBoost; при срыве
 *    зависимости снимается ровно фактическая прибавка (текущая − (applied − from)): если игрок за это время
 *    менял тяжесть сам, его правка сохраняется.
 * @returns {Promise<{granted:{key:string,name:string,severity:number}[], boosted:{name:string,from:number,to:number}[],
 *   removed:string[], restored:{name:string,to:number}[]}>}
 */
export async function syncWithdrawalDisorders(actor) {
  const out = { granted: [], boosted: [], removed: [], restored: [] };
  if (!actor?.items) return out;
  const wanted = withdrawalDisorders(actor.items, readWithdrawalEntries(actor));
  const isWanted = key => wanted.some(w => w.key === key);
  const all = () => [...actor.items];
  const mine = all().filter(isMine);

  const stale = mine.filter(i => !isWanted(flagOf(i, WITHDRAWAL_DISORDER_FLAG)));
  if (stale.length) {
    try {
      await actor.deleteEmbeddedDocuments("Item", stale.map(i => i.id));
      out.removed.push(...stale.map(i => i.name));
    } catch (e) { console.warn("warhammer-dbc | зависимость: не снять расстройство", e); }
  }

  // Своё расстройство, поднятое зависимостью, которой больше нет, — вернуть тяжесть и убрать метку.
  for (const item of all().filter(i => i?.type === "mentalDisorder" && flagOf(i, WITHDRAWAL_BOOST_FLAG))) {
    const b = flagOf(item, WITHDRAWAL_BOOST_FLAG);
    if (isWanted(b.key)) continue;
    const to = clampSeverity((Number(item.system?.severity) || 0) - ((Number(b.applied) || 0) - (Number(b.from) || 0)));
    try {
      await item.update({ "system.severity": to, [`flags.${NS}.-=${WITHDRAWAL_BOOST_FLAG}`]: null });
      out.restored.push({ name: item.name, to });
    } catch (e) { console.warn("warhammer-dbc | зависимость: не вернуть тяжесть расстройства", e); }
  }

  for (const w of wanted) {
    if (mine.some(i => flagOf(i, WITHDRAWAL_DISORDER_FLAG) === w.key)) continue;
    const own = all().find(i => i?.type === "mentalDisorder" && i.name === w.name);
    if (own) {
      // Уже поднято этой зависимостью — вторая прибавка не нужна.
      if (flagOf(own, WITHDRAWAL_BOOST_FLAG)?.key === w.key) continue;
      const from = Number(own.system?.severity) || 0;
      const applied = clampSeverity(from + w.severity);
      try {
        await own.update({ "system.severity": applied, [`flags.${NS}.${WITHDRAWAL_BOOST_FLAG}`]: { key: w.key, from, applied } });
        out.boosted.push({ name: own.name, from, to: applied });
      } catch (e) { console.warn("warhammer-dbc | зависимость: не поднять тяжесть расстройства", e); }
      continue;
    }
    const entry = DISORDER_LIBRARY.find(d => d.name === w.name) ?? { name: w.name, desc: "", testMod: 0 };
    try {
      const { createDisorderItem } = await import("../sheets/tabs/disorders.mjs");
      const item = await createDisorderItem(actor, entry, {
        system: { severity: w.severity },
        flags: { [NS]: { [WITHDRAWAL_DISORDER_FLAG]: w.key } }
      });
      if (item) out.granted.push(w);
    } catch (e) { console.warn("warhammer-dbc | зависимость: не выдать расстройство", e); }
  }
  return out;
}

/**
 * Персонаж зависим от препарата (task-9717): запись флага АКТОРА-получателя, а не
 * поле предмета — удалённый флакон зависимость не снимает, доза от другого
 * персонажа ложится на получателя. Отсчёт частоты приёма идёт с `now` с нуля:
 * это же вызывается, когда доза принята (штраф снят, периоды обнулены).
 * Снимок настроек Зависимости берётся с предмета, если у него она заведена;
 * иначе остаётся прежний снимок записи.
 */
export async function startWithdrawal(actor, item, now = globalThis.game?.time?.worldTime ?? 0) {
  if (!actor?.setFlag) return;
  const key = drugKey(item);
  const prev = readWithdrawalEntries(actor)[key];
  const add = item?.system?.addiction;
  const addiction = add?.hasAddiction ? addictionSnapshot(add) : (prev?.addiction ?? {});
  const entry = { ...freshEntry(now), addicted: true, name: item?.name ?? prev?.name ?? key, addiction };
  try { await actor.setFlag(NS, WITHDRAWAL_FLAG, { [key]: entry }); }
  catch (e) { console.warn("warhammer-dbc | зависимость: не записать отсчёт частоты приёма", e); }
  // Зависимость возникла (или доза принята — расстройство от дозы не уходит): расстройство-эффект выдаётся сразу.
  await notifyDisorders(await syncWithdrawalDisorders(actor));
}

/**
 * Сообщения игроку о выданном, поднятом, снятом и возвращённом расстройстве зависимости — оно не должно ни
 * появляться, ни меняться, ни исчезать молча.
 */
async function notifyDisorders({ granted, boosted, removed, restored }) {
  const ntf = globalThis.ui?.notifications;
  const info = m => ntf?.info?.(m);
  for (const g of granted) info(`Зависимость: на лист добавлено ментальное расстройство «${g.name}» (тяжесть ${g.severity}); оно останется, пока зависимость не будет сорвана.`);
  for (const b of boosted) info(`Зависимость: тяжесть расстройства «${b.name}» ${b.from} → ${b.to}; после срыва зависимости вернётся.`);
  for (const name of removed) info(`Расстройство «${name}» снято: зависимость сорвана.`);
  for (const r of restored) info(`Расстройство «${r.name}»: зависимость сорвана, тяжесть возвращена (${r.to}).`);
}

/**
 * Зависимость снята — запись не нужна. `drug` — предмет или ключ препарата (у
 * зависимости от удалённого препарата предмета уже нет). null (а не удаление
 * ключа) — setFlag сливает объекты.
 */
export async function endWithdrawal(actor, drug) {
  const key = drugKey(drug);
  if (!actor?.setFlag || readWithdrawalEntries(actor)[key] == null) return;
  try { await actor.setFlag(NS, WITHDRAWAL_FLAG, { [key]: null }); }
  catch (e) { console.warn("warhammer-dbc | зависимость: не снять отсчёт", e); }
  // Зависимость сорвана — выданное ею расстройство снимается, поднятая тяжесть своего возвращается.
  await notifyDisorders(await syncWithdrawalDisorders(actor));
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
export async function drugWithdrawalClock(actor, range) {
  // Расстройство зависимости сверяется ПОСЛЕДНИМ шагом и всегда: зависимостей нет — снимается то, что выдавалось;
  // зависимость есть, а расстройство удалили руками — возвращается (и игроку об этом сказано).
  try { await withdrawalClockBody(actor, range); }
  finally { await notifyDisorders(await syncWithdrawalDisorders(actor)); }
}

async function withdrawalClockBody(actor, { from, to }) {
  const records = addictionRecords(actor.items, readWithdrawalEntries(actor));
  if (!records.length) return;
  for (const { key, name, entry, add } of records) {
    const period = parseFrequency(add.frequency);
    if (!period) continue;
    if (entry.lastDose == null) {
      // Метки дозы нет (зависимость перенесена миграцией или поставлена вручную):
      // отсчёт — с КОНЦА этого отрезка. С начала нельзя: после большого сдвига
      // Календаря штраф включился бы задним числом, а тест на срыв сразу открылся
      // бы с бонусом +10 за каждый «прожитый» период (ревью wdbc-gyqf2).
      await actor.setFlag(NS, WITHDRAWAL_FLAG, { [key]: { ...entry, ...freshEntry(Number(to)) } });
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
    await chat(actor, `${rollIcon("warn", "#d9a066")}${esc(actor.name)} — зависимость: ${esc(name)}`,
      lines.map(l => `<div class="roll-threshold">${l}</div>`).join(""), rolls);
  }
}

// module/rules/warp-eater.mjs
// ════════════════════════════════════════════════════════════════════════
//  Пожиратель Варпа / Warp Eater (Общая мутация, wdbc-1rno):
//  «Питаясь только мощью Варпа, персонаж должен раз в месяц проходить тест
//  на Cor+10, или получить 1 Порчи. Если же он в течение месяца хотя бы 4
//  раза питается эмоциями, уникальными для каждой субмутации, он не
//  получает Порчи».
//
//  Конкретное «чем питается» (любопытство/страх/удивление/агония/…, d10
//  субмутация, зафиксирована при получении Мутации на всю жизнь персонажа)
//  — событие за столом, движку сверять не с чем (тот же принцип, что
//  Priest of Bloodshed/Tireless Warrior): кнопка на предмете САМОПОДТВЕРЖДАЕТ
//  «насытился» и увеличивает счётчик throttleCount(actor, ..., "month", 4)
//  (rules/cooldown.mjs — тот же примитив, для которого добавляли единицу
//  "month", wdbc-1rno, 01.09.2026). Механика ОДНА на все 10 субмутаций,
//  различается только текст кнопки на конкретном предмете.
//
//  Флаг счётчика живёт НА АКТОРЕ (не на предмете) — сценарий «съел Мутацию
//  прямым импортом без её собственного Item» не встречается, но хранить на
//  акторе проще: не нужно искать, какой именно Item выдал capability.
// ════════════════════════════════════════════════════════════════════════

import { SECONDS_PER_MONTH } from "../constants/imperial-calendar.mjs";
import { hasRuleFlag } from "./flags.mjs";
import { esc } from "../helpers/utils.mjs";

export const WARP_EATER_FLAG = "mutation.warpEater";
export const WARP_EATER_FEED_KEY = "warpEaterFeed";
const LAST_MONTH_FLAG = "warpEaterLastMonth";
const FEED_THRESHOLD = 4;

/** Номер календарного 30-суточного месяца от эпохи worldTime=0. */
export function monthOf(worldTime) {
  return Math.floor((Number(worldTime) || 0) / SECONDS_PER_MONTH);
}

/** Сколько «насыщений» засчитано ИМЕННО за месяц targetMonth (не «сейчас»,
 *  в отличие от rules/cooldown.mjs::throttleCount — та сравнивает только с
 *  live-текущим месяцем, а на updateWorldTime нам нужен ТОЛЬКО ЧТО
 *  закончившийся). Свежая метка (entry.month !== targetMonth) — 0: либо ещё
 *  не кормился, либо это уже счётчик следующего месяца. */
export function feedCountForMonth(actor, targetMonth) {
  const entry = actor?.getFlag?.("warhammer-dbc", `usageLimits.${WARP_EATER_FEED_KEY}`);
  if (!entry || entry.month !== targetMonth) return 0;
  return Number(entry.count) || 0;
}

/**
 * updateWorldTime-хук: сколько КАЛЕНДАРНЫХ месяцев закончилось со времени
 * последней проверки — на каждый, где насыщений было меньше 4, форсированный
 * тест Cor+10 (провал = 1 Порчи). Первый вызов на новом акторе (нет метки)
 * инициализирует базовую линию БЕЗ теста — иначе персонаж получал бы Порчу
 * за месяцы ДО того, как движок начал его отслеживать.
 */
export async function processWarpEaterMonthCheck(actor, worldTime) {
  if (!hasRuleFlag(actor, WARP_EATER_FLAG)) return;
  const currentMonth = monthOf(worldTime);
  const lastMonth = actor.getFlag("warhammer-dbc", LAST_MONTH_FLAG);
  if (lastMonth == null) {
    await actor.setFlag("warhammer-dbc", LAST_MONTH_FLAG, currentMonth);
    return;
  }
  if (currentMonth <= lastMonth) return;

  const lines = [];
  let corGain = 0;
  for (let m = lastMonth; m < currentMonth; m++) {
    const fed = feedCountForMonth(actor, m);
    if (fed >= FEED_THRESHOLD) {
      lines.push(`Месяц ${m}: насыщений <b>${fed}</b> — Порча не грозит.`);
      continue;
    }
    const cor = Number(actor.system?.corruption?.value) || 0;
    const target = cor + 10;
    const roll = await new Roll("1d100").evaluate();
    const failed = roll.total > target;
    if (failed) {
      corGain += 1;
      lines.push(`Месяц ${m}: насыщений <b>${fed}</b>/4 — тест Cor+10 (порог <b>${target}</b>, бросок <b>${roll.total}</b>): <b>провал</b>, +1 Порчи.`);
    } else {
      lines.push(`Месяц ${m}: насыщений <b>${fed}</b>/4 — тест Cor+10 (порог <b>${target}</b>, бросок <b>${roll.total}</b>): <b>успех</b>.`);
    }
  }

  if (corGain > 0) {
    await actor.update({ "system.corruption.value": (Number(actor.system?.corruption?.value) || 0) + corGain });
  }
  await actor.setFlag("warhammer-dbc", LAST_MONTH_FLAG, currentMonth);

  await ChatMessage.create(ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="wh-roll-result">
      <div class="roll-header">Пожиратель Варпа — ${esc(actor.name)}</div>
      ${lines.map(l => `<div class="roll-threshold">${l}</div>`).join("")}
    </div>`
  }, game.settings.get("core", "rollMode")));
}

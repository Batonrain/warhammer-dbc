// module/migrations/gun-arm-source.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Разовая простановка: какое оружие вросло в предплечье по Дару «Рука-Пушка».
//
//  Раньше Дар давал бесконечные патроны ЛЮБОМУ пистолету и любой винтовке
//  носителя — включая ту, что он только что достал из рюкзака (wdbc-spsd).
//  Теперь действует ровно одно помеченное оружие (flags.warhammer-dbc.
//  gunArmSource), и метку ставит ГМ на листе Дара.
//
//  У персонажей, уже живущих в мире, метки нет ни на чём: после обновления Дар
//  молча перестал работать, и заметить это можно было только по кончившимся
//  патронам (wdbc-vkt). Миграция ставит метку там, где выбор ОДНОЗНАЧЕН —
//  подходящее оружие у носителя ровно одно. Если их несколько, выбор остаётся
//  за ГМом: угадывать, какая из двух винтовок вросла в руку, движку нечем.
// ════════════════════════════════════════════════════════════════════════════

import { GUN_ARM_CLASSES, isGunArmGift, isGunArmWeapon } from "../rules/gun-arm.mjs";

const FLAG = "warhammer-dbc";

/** Оружие, которое Дар мог бы втянуть: нужного класса и ещё не помеченное. */
export function gunArmCandidates(items = []) {
  return [...items].filter(i =>
    i?.type === "weapon" && GUN_ARM_CLASSES.includes(i.system?.weaponClass));
}

/**
 * Что делать с этим актором — чистое решение, без записи.
 *
 * @returns {{action: "skip"|"mark"|"ask", weaponId?: string, count?: number}}
 *   skip — Дара нет либо метка уже стоит; mark — кандидат ровно один;
 *   ask — кандидатов несколько, выбор за ГМом.
 */
export function gunArmDecision(items = []) {
  const list = [...items];
  if (!list.some(isGunArmGift)) return { action: "skip" };
  if (list.some(isGunArmWeapon))  return { action: "skip" };
  const candidates = gunArmCandidates(list);
  if (candidates.length === 1) return { action: "mark", weaponId: candidates[0].id };
  if (candidates.length > 1)   return { action: "ask", count: candidates.length };
  return { action: "skip" };
}

/** Проставляет метку тем, у кого выбор однозначен; остальных называет ГМу. */
export async function migrateGunArmSource() {
  if (!game.user?.isGM) return;
  let marked = 0;
  const ask = [];

  for (const actor of game.actors ?? []) {
    try {
      const decision = gunArmDecision(actor.items);
      if (decision.action === "mark") {
        await actor.items.get(decision.weaponId)?.setFlag(FLAG, "gunArmSource", true);
        marked++;
      } else if (decision.action === "ask") {
        ask.push(`${actor.name} (${decision.count})`);
      }
    } catch (e) { console.error(`Warhammer DBC | Рука-Пушка (${actor?.name}):`, e); }
  }

  if (marked) {
    const msg = `Рука-Пушка: вросшее оружие отмечено у ${marked} персонажей.`;
    console.log("Warhammer DBC |", msg);
    ui.notifications?.info("Warhammer DBC: " + msg);
  }
  if (ask.length) ui.notifications?.warn(
    `Рука-Пушка: у кого несколько подходящих стволов — выберите вросший на листе Дара: ${ask.join(", ")}.`);
  return { marked, ask };
}

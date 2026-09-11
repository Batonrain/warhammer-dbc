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

/**
 * Простановка метки ОДНОМУ актору. Бросает исключение наружу — решение, что
 * делать со сбоем (пропустить и продолжить остальных), принимает вызывающий
 * код в migrateGunArmSource (тот же приём, что и в module/migrations/
 * gear-equipped.mjs). Мутирует переданный массив `ask` вместо возврата, чтобы
 * вызывающий код мог накапливать список по нескольким проходам (акторы +
 * несвязанные токены).
 *
 * @returns {number} 1, если метка проставлена, иначе 0.
 */
async function migrateOneActorGunArmSource(actor, ask) {
  const decision = gunArmDecision(actor.items);
  if (decision.action === "mark") {
    await actor.items.get(decision.weaponId)?.setFlag(FLAG, "gunArmSource", true);
    return 1;
  }
  if (decision.action === "ask") ask.push(`${actor.name} (${decision.count})`);
  return 0;
}

/**
 * Проставляет метку тем, у кого выбор однозначен, среди акторов мира и
 * несвязанных токенов сцен (wdbc-059h, по образцу gear-equipped/wdbc-dyi: у
 * токена с actorLink:false Дар и оружие лежат в его собственной ActorDelta, а
 * не в мировом Actor); остальных (несколько подходящих стволов) называет ГМу.
 *
 * Ошибка на одном акторе/токене логируется и пропускается, не прерывая
 * обработку следующих (было исправлено раньше самой миграцией, но версия
 * штамповалась безусловно — не читая failed, — поэтому недомигрированные
 * акторы не подхватывались повторным запуском; wdbc-059h).
 */
export async function migrateGunArmSource() {
  if (!game.user?.isGM) return;
  let marked = 0;
  let failed = 0;
  const ask = [];

  // Мировые акторы. Связанные токены (actorLink:true) используют тот же
  // документ Actor — им отдельный проход не нужен.
  for (const actor of game.actors ?? []) {
    try {
      marked += await migrateOneActorGunArmSource(actor, ask);
    } catch (e) {
      failed++;
      console.error(`Warhammer DBC | Рука-Пушка: сбой на акторе «${actor?.name}» (${actor?.id}), пропущен:`, e);
    }
  }

  // Несвязанные токены сцен: их синтетический актор (tokenDoc.actor) пишет
  // прямо в ActorDelta токена.
  for (const scene of game.scenes ?? []) {
    for (const tokenDoc of scene.tokens?.contents ?? []) {
      if (tokenDoc.actorLink) continue;
      const actor = tokenDoc.actor;
      if (!actor) continue;
      try {
        marked += await migrateOneActorGunArmSource(actor, ask);
      } catch (e) {
        failed++;
        console.error(`Warhammer DBC | Рука-Пушка: сбой на токене «${tokenDoc.name}» сцены «${scene.name}» (${tokenDoc.id}), пропущен:`, e);
      }
    }
  }

  if (marked) {
    const msg = `Рука-Пушка: вросшее оружие отмечено у ${marked} персонажей.`;
    console.log("Warhammer DBC |", msg);
    ui.notifications?.info("Warhammer DBC: " + msg);
  }
  if (ask.length) ui.notifications?.warn(
    `Рука-Пушка: у кого несколько подходящих стволов — выберите вросший на листе Дара: ${ask.join(", ")}.`);
  if (failed) console.warn(`Warhammer DBC | Рука-Пушка: ${failed} акторов/токенов пропущено из-за ошибок — миграция повторится при следующей загрузке мира.`);
  return { marked, ask, failed };
}

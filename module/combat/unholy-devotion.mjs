// module/combat/unholy-devotion.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Unholy Devotion / Нечестивая Преданность — Foundry-часть (числа и книжный
//  текст — rules/unholy-devotion.mjs). Опора — combat/fanatic-redirect.mjs: тот
//  же приём «карточка атаки показывает, кто может прикрыть цель; сам перенос
//  урона — обычная кнопка «Применить урон» на выделенном токене прикрывшего»,
//  потому что attack-card.mjs уже применяет урон к цели, выбранной в момент
//  нажатия.
//
//  Что считается сама система: какие Миньоны Хозяина достают (расстояние их
//  токена до цели ≤ их Полудвижения), +30 вблизи (≤ 2 м), бросок A+0 и «раз в
//  Раунд на Миньона» (rules/cooldown.mjs). Попытка тратится при любом исходе —
//  книга: «может попытаться … только один раз в Раунд».
// ════════════════════════════════════════════════════════════════════════════

import { hasRuleFlag } from "../rules/flags.mjs";
import { isCapabilityAvailable, markCapabilityUsed } from "../rules/cooldown.mjs";
import { testOutcome } from "../rules/roll-outcome.mjs";
import {
  UNHOLY_DEVOTION_CAP, UNHOLY_DEVOTION_USE_FLAG, NEAR_RANGE_M,
  devotionInReach, devotionBonus, devotionThreshold, isMinionOf
} from "../rules/unholy-devotion.mjs";
import { tokenDistance } from "./fanatic-redirect.mjs";
import { postTestCard, rollStatLine, outcomeHtml } from "../helpers/test-card.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { esc } from "../helpers/utils.mjs";

/** Раз в Раунд на Миньона: свободна ли попытка. */
export function devotionAvailable(minion) {
  return isCapabilityAvailable(minion, UNHOLY_DEVOTION_USE_FLAG, "round");
}

/**
 * Миньоны Хозяина-цели, способные принять попадание: Хозяин с Талантом, у
 * Миньона есть токен, и он не дальше своего Полудвижения от токена цели.
 * Нет токена цели (стрельба «на словах») — пусто: расстояние взять неоткуда.
 * @returns {{uuid:string, name:string, distance:number, bonus:number, threshold:number, available:boolean}[]}
 */
export function unholyDevotionCandidates(targetToken, defender, allActors) {
  if (!targetToken || !defender || !hasRuleFlag(defender, UNHOLY_DEVOTION_CAP)) return [];
  const out = [];
  for (const a of allActors ?? []) {
    if (!isMinionOf(a, defender)) continue;
    const token = a.getActiveTokens?.()[0];
    if (!token || token === targetToken) continue;
    const distance = tokenDistance(token, targetToken);
    if (!devotionInReach(a.system?.movement?.halfMove, distance)) continue;
    const ag = a.system?.characteristics?.ag?.total ?? 0;
    out.push({
      uuid: a.uuid, name: a.name, distance: Math.round(distance * 10) / 10, rawDistance: distance,
      bonus: devotionBonus(distance), threshold: devotionThreshold(ag, distance),
      available: devotionAvailable(a)
    });
  }
  return out;
}

/**
 * Попытка Миньона принять попадание: A+0 (+30 вблизи), тратит попытку Раунда.
 * @returns {Promise<{success:boolean, rv:?number, threshold:number}|null>} null — попытка этого Раунда уже была
 */
export async function rollUnholyDevotion(minion, distance, masterName = "") {
  if (!devotionAvailable(minion)) return null;
  const ag = minion.system?.characteristics?.ag?.total ?? 0;
  const bonus = devotionBonus(distance);
  const threshold = devotionThreshold(ag, distance);
  const roll = await new Roll("1d100").evaluate();
  const rv = roll.total;
  const { success } = testOutcome(rv, threshold);
  await markCapabilityUsed(minion, UNHOLY_DEVOTION_USE_FLAG, "round");
  await postTestCard(minion, {
    icon: rollIcon("shield", "#ffb347"),
    title: `Нечестивая Преданность — ${esc(minion.name)}${masterName ? ` → ${esc(masterName)}` : ""}`,
    threshold: rollStatLine({
      label: "Ag+0", base: ag,
      parts: bonus ? [`не дальше ${NEAR_RANGE_M} м от Хозяина +${bonus}`] : [], threshold, rv
    }),
    outcome: outcomeHtml(success, success
      ? `Принимает удар на себя — выделите токен ${esc(minion.name)} и примените урон ему вместо Хозяина.`
      : "Не успел — удар достаётся Хозяину. Новая попытка — со следующего Раунда.")
  }, { rolls: [roll] });
  return { success, rv, threshold };
}

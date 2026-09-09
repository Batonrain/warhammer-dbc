// module/combat/vulture.mjs
// ════════════════════════════════════════════════════════════════════════
//  Стервятник / Vulture (Дар Нургла, d100 88..91, wdbc-1rno):
//  «Когда в пределах 7 м от него находится хотя бы три персонажа с −5 Ран
//  или меньше или свежих трупа, умерших в течение того же боя или сцены…
//  персонаж в начале своего Хода получает одно Очко Бесчестия, которое
//  пропадёт в начале его следующего Хода, если он его не потратит».
//
//  Очко именно ВРЕМЕННОЕ — не в общий пул Судьбы/Бесчестия: для этого уже
//  есть rules/temp-infamy.mjs, чья шапка прямо называет этот срок жизни
//  («пропадёт в конце его следующего Хода») как своего будущего второго
//  потребителя. Здесь он и появился.
//
//  «−5 Ран или меньше» читается как system.wounds.critical ≥ 5: Раны ниже
//  нуля хранятся отдельным положительным числом (rules/wound-tier.mjs),
//  а не отрицательным value.
//
//  «Свежие трупы» отдельно НЕ считаются, и это не упущение: понятия
//  «смерть» в системе нет вовсе (см. разбор в шапке combat/deadly-
//  effectiveness.mjs — движок знает только Тир Ран "dying"). На практике
//  лежащий на сцене труп это токен с глубоко отрицательными Ранами, и он
//  проходит тот же порог. Оговорка книги «но не от эффектов, что уничтожают
//  их тела или головы» не проверяется ничем — это решение стола.
// ════════════════════════════════════════════════════════════════════════

import { hasRuleFlag } from "../rules/flags.mjs";
import { tokensWithinRadius } from "../rules/aoe-target.mjs";
import { tempInfamyInfo, grantTempInfamy, clearTempInfamy } from "../rules/temp-infamy.mjs";

export const VULTURE = "gift.nurgle.vulture";
export const VULTURE_SOURCE = "Стервятник";
const RADIUS_M = 7;
const WOUNDS_BELOW = 5;

/** Токен считается «умирающим или трупом» для Стервятника: Раны −5 и ниже. */
export function isVultureFodder(actor) {
  return (Number(actor?.system?.wounds?.critical) || 0) >= WOUNDS_BELOW;
}

/** Сколько подходящих тел вокруг — порог книги 3. */
export function vultureFodderCount(tokenDocs) {
  return (tokenDocs ?? []).filter(t => isVultureFodder(t?.actor)).length;
}

export function vultureQualifies(tokenDocs) {
  return vultureFodderCount(tokenDocs) >= 3;
}

/**
 * Начало своего Хода: сначала сгорает Очко прошлого Хода (если оно от
 * Стервятника и не потрачено), затем начисляется новое, если тел вокруг
 * по-прежнему хватает. Чужое временное Бесчестие (Глас Божий) не трогаем —
 * у флага один источник, и стереть его значило бы отобрать чужую валюту.
 */
export async function processVultureTurnStart(actor, tokenDoc) {
  if (!actor || !hasRuleFlag(actor, VULTURE)) return;
  if (tempInfamyInfo(actor)?.source === VULTURE_SOURCE) await clearTempInfamy(actor);
  if (!tokenDoc) return;
  if (tempInfamyInfo(actor)) return; // занято чужим источником — не перетираем
  const near = tokensWithinRadius(tokenDoc, RADIUS_M);
  if (!vultureQualifies(near)) return;
  await grantTempInfamy(actor, 1, {
    source: VULTURE_SOURCE,
    restriction: "Сгорает в начале следующего Хода, если не потрачено"
  });
}

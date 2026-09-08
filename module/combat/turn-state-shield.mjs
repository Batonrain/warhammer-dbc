// module/combat/turn-state-shield.mjs
// ════════════════════════════════════════════════════════════════════════
//  ЩИТ ПО СОСТОЯНИЮ ХОДА (wdbc-1rno).
//
//  Книга несколько раз даёт одну и ту же конструкцию: «если персонаж
//  закончил свой Ход ТАК-ТО — он получает не перегружающийся щит-дефлектор
//  1-XX до начала своего следующего Хода». Это НЕ снижение урона плоским
//  числом (для того уже есть incomingDamageReduction, combat/just-the-
//  light.mjs) — это настоящий бросок щита d100 ≤ рейтинг, аннулирующий
//  попадание целиком.
//
//  Прошлый заход по Дарам Богов записал такие находки в «нет общего
//  примитива щит-дефлектор X-Y» и оставил заглушками. Это было неверно:
//  примитив есть — встроенный Item типа "forcefield", который читает
//  combat/damage.mjs::_rollActiveShield (rating/overloadThreshold/
//  shieldType/shieldNature). Ровно так уже выдаётся Preservation/Защита
//  (combat/preservation.mjs, wdbc-sk8s). Не хватало только СРОКА ЖИЗНИ —
//  «до начала своего следующего Хода», — и он здесь.
//
//  Метка живёт на самом выданном предмете (flags.warhammer-dbc.
//  turnStateShield = ключ источника), не списком id на акторе — тот же
//  приём и та же причина, что у rules/temp-grant.mjs: снять предмет
//  значит снять метку, рассинхрону взяться неоткуда.
//
//  Такты (module/hooks.mjs::updateCombat, там же, где Snapshot и Лишь
//  Свет): выдача — конец Хода носителя, снятие — начало его следующего
//  Хода. Плюс уборка на deleteCombat: предмет, в отличие от флага, видно
//  в инвентаре, и «забытый» щит после боя выглядел бы как настоящий.
//
//  «Не перегружающийся» = overloadThreshold 0. Природа "warp" —
//  чародейский: Освящённое оружие (sanctified) его пропускает, что для
//  дара Бога Хаоса правильно. «Складывается с другими щитами» книга здесь
//  не обещает, а движок и не умеет (_rollActiveShield берёт только самый
//  мощный активный) — ограничение конвейера, честно описанное в шапке
//  preservation.mjs.
// ════════════════════════════════════════════════════════════════════════

import { hasRuleFlag } from "../rules/flags.mjs";
import { hasActionEconomy, effectiveActionPointsMax } from "./action-economy.mjs";

const NS = "warhammer-dbc";
const ITEM_FLAG = "turnStateShield";

/** Возможность «Щит Праздности» (Дар Нургла, d100 44..47). */
export const SHIELD_OF_SLOTH = "gift.nurgle.shieldOfSloth";

/**
 * Рейтинг Щита Праздности по остатку ОД на конец Хода — null, если не положен.
 *
 * «Хотя бы одно не потраченное полудействие» — Полудействие стоит 1 ОД
 * (стр. 12), значит apLeft ≥ 1. «Не потратив своих действий вовсе» — весь
 * пул на месте, поэтому сравнение идёт с effectiveActionPointsMax (тем же
 * числом, которым Ход и начинался: с надбавкой Решительности Сражаться),
 * а не с хранимым actionPoints.max.
 */
export function shieldOfSlothRating(apLeft, apMax) {
  const left = Number(apLeft) || 0;
  const max  = Number(apMax)  || 0;
  if (left <= 0) return null;
  return left >= max && max > 0 ? 99 : 77;
}

/** Выдаёт не перегружающийся чародейский щит-дефлектор с меткой источника. */
async function grantTurnStateShield(actor, { key, name, rating }) {
  await actor.createEmbeddedDocuments("Item", [{
    name,
    type: "forcefield",
    img: "systems/warhammer-dbc/assets/item-icons/forcefield.svg",
    system: {
      shieldNature: "warp", shieldType: "deflector",
      ratingMin: 1, ratingMax: rating, overloadThreshold: 0,
      currentRating: rating, isSpecialRating: false,
      equipped: true, status: "active", quality: "common", availability: 0, weight: 0
    },
    flags: { [NS]: { [ITEM_FLAG]: key } }
  }]);
}

/** id всех щитов по состоянию Хода, что сейчас висят на акторе. */
export function turnStateShieldIds(actor) {
  return (actor?.items?.contents ?? [])
    .filter(i => i.type === "forcefield" && i.getFlag?.(NS, ITEM_FLAG))
    .map(i => i.id);
}

/** Снимает все такие щиты — начало своего Хода носителя либо конец боя. */
export async function clearTurnStateShields(actor) {
  const ids = turnStateShieldIds(actor);
  if (ids.length) await actor.deleteEmbeddedDocuments("Item", ids);
}

/**
 * Конец Хода актора: Щит Праздности, если Ход закончился с непотраченным
 * полудействием. Старый щит снимается перед выдачей — иначе два подряд
 * ленивых Хода оставили бы на акторе две копии.
 */
export async function processTurnStateShieldsTurnEnd(actor) {
  if (!actor || !hasActionEconomy(actor)) return;
  if (!hasRuleFlag(actor, SHIELD_OF_SLOTH)) return;
  const rating = shieldOfSlothRating(actor.system?.actionPoints?.value, effectiveActionPointsMax(actor));
  if (rating == null) return;
  await clearTurnStateShields(actor);
  await grantTurnStateShield(actor, {
    key: SHIELD_OF_SLOTH,
    name: `Щит Праздности (1-${rating}/−)`,
    rating
  });
}

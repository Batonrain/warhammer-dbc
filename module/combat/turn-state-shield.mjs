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
import { attackedThisTurn } from "../rules/turn-flags.mjs";
import { enemyContactTokenDocs } from "./free-attack.mjs";

const NS = "warhammer-dbc";
const ITEM_FLAG = "turnStateShield";
// «Не перегружающийся» касается ЛЮБОГО попадания у Щита Праздности, но
// Кровопомазанник (ниже) книга ограничивает «от стрелковых атак/взрывов» —
// этот флаг на самом выданном предмете читает combat/damage.mjs::
// _rollActiveShield, чтобы отличить один случай от другого без нового поля
// схемы forcefield.mjs (общей для десятков непричастных предметов).
export const RANGED_ONLY_FLAG = "turnStateShieldRangedOnly";

/** Возможность «Щит Праздности» (Дар Нургла, d100 44..47). */
export const SHIELD_OF_SLOTH = "gift.nurgle.shieldOfSloth";
/** Возможность «Кровопомазанник» (Дар Кхорна). */
export const BLOOD_ANOINTED = "gift.khorne.bloodAnointed";

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
async function grantTurnStateShield(actor, { key, name, rating, rangedOnly = false }) {
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
    flags: { [NS]: { [ITEM_FLAG]: key, ...(rangedOnly ? { [RANGED_ONLY_FLAG]: true } : {}) } }
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
 * Кровопомазанник (Дар Кхорна, wdbc-1rno): «если в свой предыдущий Ход не
 * стрелял и либо был связан в рукопашной, либо шёл к противнику — щит-
 * дефлектор 1-44 (1-88 в крови) от стрелковых атак/взрывов».
 *
 * «Не стрелял» — ни одно оружие из attackedThisTurn не оказалось нерукопашным
 * (weaponClass читается с самого предмета, книга не разбирает «стрелял мимо»
 * отдельно от «стрелял и попал» — сам факт атаки уже снимает щит).
 *
 * «Связан в рукопашной» — Базовый/Глубокий контакт с враждебным токеном
 * личного масштаба на конец Хода (тот же приём измерения, что у Свободной
 * Атаки, combat/free-attack.mjs::enemyContactTokenDocs) — реальная геометрия
 * сцены, не декларация.
 *
 * НЕ проверяется «шёл в направлении к противнику» — движок не хранит
 * позицию НАЧАЛА Хода отдельно от текущей, посчитать «стало ближе к кому из
 * противников» здесь нечем (честная граница, см. capabilities.mjs). Персонаж,
 * весь Ход шедший к врагу, но не дошедший до контакта, щита не получит —
 * это реальный, а не гипотетический пробел.
 *
 * «Измазан кровью» (эскалация 44→88) тоже не проверяется — состояние
 * не отслеживается нигде в системе, книга не даёт для него ни триггера,
 * ни числа для автоопределения.
 *
 * @param {Actor} actor
 * @param {?TokenDocument} tokenDoc  токен actor на сцене, для геометрии контакта
 * @returns {?number} null — условие не выполнено
 */
export function bloodAnointedRating(actor, tokenDoc) {
  const shotThisTurn = attackedThisTurn(actor).some(id => {
    const item = actor?.items?.get?.(id);
    return item && (item.system?.weaponClass || "melee") !== "melee";
  });
  if (shotThisTurn) return null;
  const engaged = tokenDoc ? enemyContactTokenDocs(tokenDoc).length > 0 : false;
  if (!engaged) return null;
  return 44;
}

/**
 * Конец Хода актора: Щит Праздности (непотраченное полудействие) и
 * Кровопомазанник (не стрелял + связан в рукопашной) — оба через один
 * примитив, оба «до начала следующего своего Хода». Старый щит снимается
 * перед выдачей — иначе два подряд Хода, оба удовлетворяющих условию,
 * оставили бы на акторе две копии.
 */
export async function processTurnStateShieldsTurnEnd(actor, tokenDoc = null) {
  if (!actor || !hasActionEconomy(actor)) return;

  if (hasRuleFlag(actor, SHIELD_OF_SLOTH)) {
    const rating = shieldOfSlothRating(actor.system?.actionPoints?.value, effectiveActionPointsMax(actor));
    if (rating != null) {
      await clearTurnStateShields(actor);
      await grantTurnStateShield(actor, {
        key: SHIELD_OF_SLOTH,
        name: `Щит Праздности (1-${rating}/−)`,
        rating
      });
      return;
    }
  }

  if (hasRuleFlag(actor, BLOOD_ANOINTED)) {
    const rating = bloodAnointedRating(actor, tokenDoc);
    if (rating != null) {
      await clearTurnStateShields(actor);
      await grantTurnStateShield(actor, {
        key: BLOOD_ANOINTED,
        name: `Щит Кровопомазанника (1-${rating}/− от стрелковых)`,
        rating,
        rangedOnly: true
      });
    }
  }
}

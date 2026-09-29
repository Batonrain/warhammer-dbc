// module/combat/inspiring-presence.mjs
//
// Обвязка Черты «Вдохновляющее Присутствие» (Чемпион) над сценой и пулом
// Очков: чистая логика — module/rules/inspiring-presence.mjs.
//
//   inspiringChampionsFor(borrower) — Чемпионы на сцене, чьё Очко может
//     потратить этот персонаж: у Чемпиона Черта, токены — союзники (одна
//     диспозиция), токен бросающего в поле зрения Чемпиона
//     (rules/vision-target.mjs::isTokenInSight — дальность и сектор обзора,
//     без стен: та же приближённая «видимость», что у Иконы Богохульства).
//   spendInspiringInfamy(champion, borrower) — списать Очко Чемпиона: своим
//     клиентом, если он им владеет, иначе через активного ГМа (сокет
//     action:"inspiringPresenceSpend", приёмник — applyInspiringSpendRelay).

import { hasRuleFlag } from "../rules/flags.mjs";
import { isTokenInSight } from "../rules/vision-target.mjs";
import { tokenRelationship } from "../regions/auras.mjs";
import { tempInfamyAmount } from "../rules/temp-infamy.mjs";
import { spendFromInfamyPool, actorInfamyPath, actorInfamyValue } from "../apps/infamy-points.mjs";
import { INSPIRING_PRESENCE, canInspire, inspireBlockReason } from "../rules/inspiring-presence.mjs";

const docOf = t => t?.document ?? t;

/** Очки Бесчестия Чемпиона вместе с временным запасом. */
function poolOf(actor) {
  return actorInfamyValue(actor) + tempInfamyAmount(actor);
}

/**
 * @param {Actor} borrower  персонаж, чей тест перебрасывают
 * @returns {{actor:Actor, pool:number, reason:string}[]}
 */
export function inspiringChampionsFor(borrower) {
  if (!borrower) return [];
  const placeables = globalThis.canvas?.tokens?.placeables ?? [];
  const grid = globalThis.canvas?.scene?.grid ?? { size: 100, distance: 1 };
  const own = placeables.filter(t => t.actor?.id === borrower.id).map(docOf);
  if (!own.length) return [];
  const out = [];
  const seen = new Set();
  for (const t of placeables) {
    const champ = t.actor;
    if (!champ || seen.has(champ.id)) continue;
    const doc = docOf(t);
    const sameActor = champ.id === borrower.id;
    if (sameActor || !hasRuleFlag(champ, INSPIRING_PRESENCE)) continue;
    const ok = own.some(o => canInspire({
      sameActor, relation: tokenRelationship(doc.disposition, o.disposition), inSight: isTokenInSight(doc, o, grid)
    }));
    if (!ok) continue;
    seen.add(champ.id);
    const pool = poolOf(champ);
    const canSpend = !!champ.isOwner || !!globalThis.game?.users?.activeGM;
    out.push({ actor: champ, pool, reason: inspireBlockReason({ pool, canSpend }) });
  }
  return out;
}

/**
 * Списать одно Очко Чемпиона.
 * @returns {Promise<{poolValue:number, relayed:boolean}|null>} null — не удалось
 */
export async function spendInspiringInfamy(champion, borrower) {
  if (!champion) return null;
  if (champion.isOwner) {
    const path = actorInfamyPath(champion);
    const spend = await spendFromInfamyPool(champion, 1, path);
    if (!spend) return null;
    await champion.update({ [path]: spend.poolValue });
    return { poolValue: spend.poolValue, relayed: false };
  }
  if (!globalThis.game?.users?.activeGM) return null;
  globalThis.game.socket?.emit("system.warhammer-dbc", {
    action: "inspiringPresenceSpend", championUuid: champion.uuid, borrowerUuid: borrower?.uuid ?? "",
    userId: globalThis.game.user?.id
  });
  return { poolValue: Math.max(0, actorInfamyValue(champion) - 1), relayed: true };
}

/**
 * Приёмник сокета у ГМа: списывает Очко, только если у Чемпиона действительно
 * есть Черта и Очко, а просящий владеет тем, чей тест перебрасывается.
 * @param {{championUuid:string, borrowerUuid:string}} data
 * @param {User} requester
 */
export async function applyInspiringSpendRelay(data, requester) {
  const champion = await fromUuid(data?.championUuid).catch(() => null);
  const borrower = await fromUuid(data?.borrowerUuid).catch(() => null);
  const champActor = champion?.actor ?? champion;
  const borrowerActor = borrower?.actor ?? borrower;
  if (!champActor || !borrowerActor) return;
  if (!hasRuleFlag(champActor, INSPIRING_PRESENCE)) {
    return console.warn("Warhammer DBC | inspiringPresenceSpend отклонён: у актора нет Вдохновляющего Присутствия");
  }
  if (requester && !requester.isGM && !borrowerActor.testUserPermission?.(requester, "OWNER")) {
    return console.warn("Warhammer DBC | inspiringPresenceSpend отклонён: просящий не владеет перебрасывающим");
  }
  if (poolOf(champActor) < 1) return;
  const path = actorInfamyPath(champActor);
  const spend = await spendFromInfamyPool(champActor, 1, path);
  if (spend) await champActor.update({ [path]: spend.poolValue });
}

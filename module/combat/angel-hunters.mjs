// module/combat/angel-hunters.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Angel Hunters / Охотники на Ангелов — «раз в Раунд» и обмен в стае
//  (wdbc-erp61). Правила — rules/angel-hunters.mjs, сам переброс — правило
//  rules/library/yigori.mjs (effect.limit → ограничитель ниже).
//
//    angelHuntersSource(actor) — чьим перебросом этот Йигори может воспользоваться
//      сейчас: своим (если не потрачен в этом Раунде) либо переброс стаи —
//      соседа с Чертой, в том же Командном Присутствии и в пределах видимости
//      друг друга. null — переброса нет;
//    commitRerollUse(actor, dataset) — на подтверждении диалога броска: отметить
//      выбранный переброс потраченным (у владельца переброса; чужому — через
//      активного ГМа, сокет action:"angelHuntersSpend").
//
//  Без активного боя отследить Раунд нечем, переброс считается доступным
//  (rules/cooldown.mjs).
// ════════════════════════════════════════════════════════════════════════════

import { registerRerollLimiter } from "../rules/roll-mods.mjs";
import { PREDICATES } from "../rules/predicates.mjs";
import { isThrottleReady, markThrottleUsed } from "../rules/cooldown.mjs";
import { isTokenInSight } from "../rules/vision-target.mjs";
import { findMemberSquad } from "../rules/squad-roles.mjs";
import {
  ANGEL_HUNTERS_LIMIT, ANGEL_HUNTERS_USAGE, ANGEL_HUNTERS_TRAIT, sameCommandPresence
} from "../rules/angel-hunters.mjs";

const NS = "warhammer-dbc";
/** Обратная метка «чьё Присутствие на нём» (sheets/tabs/command.mjs::COMMANDED_BY_FLAG). */
const COMMANDED_BY_FLAG = "commandedBy";

const docOf = t => t?.document ?? t;
const hasTrait = actor => !!actor && !!PREDICATES.hasTrait(actor, {}, ANGEL_HUNTERS_TRAIT);
const ready = actor => isThrottleReady(actor, ANGEL_HUNTERS_USAGE, "round");

/** Что нужно знать о Командном Присутствии актора. */
function presenceInfo(actor) {
  const squad = findMemberSquad(actor.uuid) ?? (actor.id ? findMemberSquad(`Actor.${actor.id}`) : null);
  return {
    uuid: actor.uuid,
    squadId: squad?.uuid ?? "",
    commandedBy: actor.getFlag?.(NS, COMMANDED_BY_FLAG)?.uuid ?? ""
  };
}

/**
 * Чьим перебросом воспользуется этот актор.
 * @returns {null|{uuid:string, name:string, borrowed:boolean}}
 */
export function angelHuntersSource(actor) {
  if (!actor) return null;
  if (ready(actor)) return { uuid: actor.uuid, name: actor.name, borrowed: false };

  const placeables = globalThis.canvas?.tokens?.placeables ?? [];
  const grid = globalThis.canvas?.scene?.grid ?? { size: 100, distance: 1 };
  const own = placeables.filter(t => t.actor?.id === actor.id).map(docOf);
  if (!own.length) return null;
  const mine = presenceInfo(actor);
  const seen = new Set();
  for (const t of placeables) {
    const mate = t.actor;
    if (!mate || mate.id === actor.id || seen.has(mate.id)) continue;
    if (!hasTrait(mate) || !ready(mate)) continue;
    if (!sameCommandPresence(mine, presenceInfo(mate))) continue;
    const mateDoc = docOf(t);
    // «В пределах видимости друг друга» — в обе стороны.
    const sees = own.some(o => isTokenInSight(mateDoc, o, grid) && isTokenInSight(o, mateDoc, grid));
    if (!sees) continue;
    seen.add(mate.id);
    return { uuid: mate.uuid, name: mate.name, borrowed: true };
  }
  return null;
}

registerRerollLimiter(ANGEL_HUNTERS_LIMIT, angelHuntersSource);

/** Отметить переброс этого актора потраченным в текущем Раунде. */
async function spend(lender, borrower) {
  if (!lender) return;
  if (lender.isOwner) return markThrottleUsed(lender, ANGEL_HUNTERS_USAGE, "round");
  if (!globalThis.game?.users?.activeGM) return;
  globalThis.game.socket?.emit("system.warhammer-dbc", {
    action: "angelHuntersSpend", lenderUuid: lender.uuid, borrowerUuid: borrower?.uuid ?? "",
    userId: globalThis.game.user?.id
  });
}

/**
 * Подтверждение диалога броска с выбранным переброс-радио (его dataset).
 * Ничего не делает для перебросов без ограничителя Охотников.
 */
export async function commitRerollUse(actor, dataset = {}) {
  if (dataset?.limit !== ANGEL_HUNTERS_LIMIT) return;
  const src = dataset.sourceUuid ? await fromUuid(dataset.sourceUuid).catch(() => null) : null;
  await spend(src?.actor ?? src ?? actor, actor);
}

/**
 * Приёмник сокета у ГМа: отмечает переброс потраченным, только если у
 * делящегося есть Черта, а просящий владеет перебрасывающим.
 */
export async function applyAngelHuntersSpendRelay(data, requester) {
  const lender = await fromUuid(data?.lenderUuid).catch(() => null);
  const borrower = await fromUuid(data?.borrowerUuid).catch(() => null);
  const lenderActor = lender?.actor ?? lender;
  const borrowerActor = borrower?.actor ?? borrower;
  if (!lenderActor || !borrowerActor) return;
  if (!hasTrait(lenderActor)) {
    return console.warn("Warhammer DBC | angelHuntersSpend отклонён: у актора нет Охотников на Ангелов");
  }
  if (requester && !requester.isGM && !borrowerActor.testUserPermission?.(requester, "OWNER")) {
    return console.warn("Warhammer DBC | angelHuntersSpend отклонён: просящий не владеет перебрасывающим");
  }
  await markThrottleUsed(lenderActor, ANGEL_HUNTERS_USAGE, "round");
}

// module/rules/tip-of-spear.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Tip Of The Spear / Острие Копья (Талант Герольда; Разобрать stnbt). Книга:
//  «Попав по противнику хотя бы одной атакой ближнего боя, может за свободное
//  действие пройти тест Charm+0, чтобы дать каждому соратнику, связанному той
//  же рукопашной, один переброс атаки или парирования в Раунд до начала своего
//  следующего Хода.»
//
//  Выданный переброс — флаг TIP_OF_SPEAR_FLAG на соратнике: кто дал, в каком
//  бою, Раунде и на каком месте очереди Ходов стоит Герольд. Пока флаг жив,
//  источник правил «tipOfSpear» (rules/sources.mjs) даёт переброс атаки и
//  Парирования с ограничителем «раз в Раунд» (rules/roll-mods.mjs::
//  registerRerollLimiter) — в окне атаки радиокнопкой, на карточке Парирования
//  кнопкой после провала. Кнопка Таланта на карточке рукопашного попадания и
//  раздача — combat/tip-of-spear.mjs.
// ════════════════════════════════════════════════════════════════════════════

import { itemHasName } from "./predicates.mjs";
import { isThrottleReady, markThrottleUsed } from "./cooldown.mjs";

export const TIP_OF_SPEAR_FLAG = "tipOfSpear";
export const TIP_OF_SPEAR_LIMIT = "tipOfSpear";
export const TIP_OF_SPEAR_USAGE = "tipOfSpearReroll";
const NS = "warhammer-dbc";

/** Есть ли у актора Талант Острие Копья. */
export function hasTipOfSpear(actor) {
  return [...(actor?.items ?? [])].some(i => i?.type === "talent" && itemHasName(i, "Tip Of The Spear"));
}

/** Кнопку показывать: рукопашная атака носителя Таланта попала. */
export function tipOfSpearOffered(actor, { isMelee, hit } = {}) {
  return !!isMelee && !!hit && hasTipOfSpear(actor);
}

/** Запись для соратника: до начала следующего Хода Герольда. */
export function tipOfSpearGrant(herald, combat) {
  return {
    heraldUuid: herald?.uuid ?? "", heraldName: herald?.name ?? "",
    combatId: combat?.id ?? "", round: Number(combat?.round) || 0, turn: Number(combat?.turn) || 0
  };
}

/** Жив ли выданный переброс: тот же бой, и Ход Герольда в следующем Раунде ещё не наступил. */
export function tipOfSpearActive(grant, combat) {
  if (!grant || !combat || grant.combatId !== combat.id) return false;
  const round = Number(combat.round) || 0, turn = Number(combat.turn) || 0;
  if (round === grant.round) return true;
  return round === grant.round + 1 && turn < grant.turn;
}

const grantOf = actor => actor?.getFlag?.(NS, TIP_OF_SPEAR_FLAG) ?? actor?.flags?.[NS]?.[TIP_OF_SPEAR_FLAG] ?? null;

/** Правила переброса для источника «tipOfSpear». */
export function tipOfSpearRules(actor, combat = globalThis.game?.combat) {
  const grant = grantOf(actor);
  if (!tipOfSpearActive(grant, combat)) return [];
  const label = `Острие Копья (${grant.heraldName || "Герольд"}): переброс раз в Раунд`;
  return [{
    id: "tipOfSpear.reroll", label,
    effects: [{ kind: "rollMode", target: ["attack", "skill:parry"], mode: "keepBest", rolls: 2,
      limit: TIP_OF_SPEAR_LIMIT, label }]
  }];
}

/**
 * Ограничитель: переброс ещё не потрачен в этом Раунде. Регистрирует его
 * combat/tip-of-spear.mjs — импорт roll-mods.mjs отсюда замкнул бы круг через sources.mjs.
 */
export function tipOfSpearSource(actor, combat = globalThis.game?.combat) {
  if (!tipOfSpearActive(grantOf(actor), combat)) return null;
  if (!isThrottleReady(actor, TIP_OF_SPEAR_USAGE, "round")) return null;
  return { uuid: actor.uuid, name: actor.name, borrowed: false };
}

/** Отметить переброс потраченным (combat/angel-hunters.mjs::commitRerollUse). */
export async function spendTipOfSpear(actor) {
  if (actor) await markThrottleUsed(actor, TIP_OF_SPEAR_USAGE, "round");
}

// module/rules/alluring-presence.mjs
// Чарующее Присутствие (Alluring Presence, божественный Трейт демонов Слаанеш):
// «Все враги получают штраф −10 на Избегания против атак демона.» Избегания — Уклонение и
// Парирование. Направленный модификатор атакующий → защитник: читается с позиции цели по
// attackerUuid (тот же приём, что phantomCopiesDodgePenalty).
import { hasRuleFlag } from "./flags.mjs";

export const ALLURING_PRESENCE_CAP = "defence.enemyEvasionPenalty";
export const ALLURING_PRESENCE_PENALTY = -10;

/** Штраф к Избеганию защитника против атаки этого атакующего (0 — нет Трейта или атакующий неизвестен). */
export function alluringPresencePenalty(attackerActor) {
  return attackerActor && hasRuleFlag(attackerActor, ALLURING_PRESENCE_CAP) ? ALLURING_PRESENCE_PENALTY : 0;
}

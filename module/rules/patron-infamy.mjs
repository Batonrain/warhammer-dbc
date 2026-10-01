// module/rules/patron-infamy.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Покровительство и Очки Бесчестия (корбук 438, «Эффекты Покровительства»):
//  у каждого Бога один недостаток — способность Очков, которой Хаосит этого
//  Покровителя не может пользоваться: Нургл — «Переброс» («Принятие Судьбы»),
//  Тзинч — «Усиление» («Безумная Гордыня»), Слаанеш — «Приход в себя».
//  Источник списка — DP_INFAMY_ABILITIES[].disGod (constants/demon-prince.mjs),
//  тот же, что запрещает способность на полосе Очков (apps/infamy-points.mjs);
//  здесь тот же запрет для меню Очков на карточке броска (hooks.mjs, wdbc-8rwyw).
// ════════════════════════════════════════════════════════════════════════════

import { DP_INFAMY_ABILITIES, DP_PATRONAGE } from "../constants/demon-prince.mjs";

/**
 * Запрещает ли Покровитель актора способность Очков Бесчестия.
 * Только у Хаоситов: Бесчестье — их пул (helpers/utils.mjs::fateTerm).
 * @param {Actor} actor
 * @param {string} abilityKey  "reroll" | "boost" | "recover" …
 * @returns {string} причина для подсказки; "" — не запрещено
 */
export function patronBlocksInfamyAbility(actor, abilityKey) {
  if (actor?.system?.alignment !== "heretic") return "";
  const god = actor.system.patronGod || "undivided";
  const ability = DP_INFAMY_ABILITIES.find(a => a.key === abilityKey);
  if (!ability || ability.disGod !== god) return "";
  return DP_PATRONAGE[god]?.dis || `«${ability.label}» недоступно при этом Покровительстве`;
}

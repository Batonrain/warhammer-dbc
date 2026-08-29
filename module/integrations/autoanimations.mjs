// module/integrations/autoanimations.mjs
//
// Сторонний модуль Automated Animations (module id "autoanimations") не знает
// про warhammer-dbc: он выбирает обработчик атак по game.system.id из своего
// зашитого списка систем, нас там нет, и он падает на generic-фолбэк, который
// разбирает HTML чат-карточки и никогда не узнаёт, было ли попадание — поэтому
// анимации либо не играются, либо всегда как промах. Сообщаем исход атаки сами
// через открытый хук "aa.workflow": сам AA регистрирует на нём слушателя при
// ready (src/index.js в его репозитории), так что если модуль не установлен
// или выключен, Hooks.callAll ниже просто никто не услышит.

/** Активен ли Automated Animations; вне Foundry (vitest) — всегда false. */
export function isAutoAnimationsActive() {
  return typeof game !== "undefined" && !!game.modules?.get?.("autoanimations")?.active;
}

/** Хук и game.modules вне Foundry не существуют: под vitest функция — no-op. */
export function triggerAttackAnimation({ actor, item, hit }) {
  if (typeof Hooks === "undefined") return;
  if (!isAutoAnimationsActive()) return;
  const sourceToken = actor?.getActiveTokens?.()[0];
  if (!sourceToken) return;
  const targets = Array.from(game.user?.targets ?? []);
  if (!targets.length) return;
  Hooks.callAll("aa.workflow", sourceToken, item, { targets, hit });
}

/**
 * Взрывное/Распыление (module/hooks.mjs, .wh-place-template-btn): попадание
 * уже известно (шаблон размещён и накрытые токены найдены) — bypass'им
 * game.user.targets/actor из triggerAttackAnimation выше, тут всё приходит
 * готовым с кнопки карточки. region — эфемерный RegionDocument из
 * module/combat/templates.mjs::placeAttackTemplate, передаём его как
 * templateData (AA понимает Region-объекты для template-анимаций).
 */
export async function triggerBlastAnimation({ attackerUuid, itemUuid, tokens, region }) {
  if (typeof Hooks === "undefined") return;
  if (!isAutoAnimationsActive()) return;
  if (!tokens?.length || !attackerUuid || !itemUuid) return;
  const actor = await fromUuid(attackerUuid);
  const item = await fromUuid(itemUuid);
  const sourceToken = actor?.getActiveTokens?.()[0];
  if (!sourceToken || !item) return;
  Hooks.callAll("aa.workflow", sourceToken, item, { targets: tokens, hit: true, templateData: region });
}

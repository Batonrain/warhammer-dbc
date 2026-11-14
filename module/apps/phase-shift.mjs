// module/apps/phase-shift.mjs
// Фаза (Phase): «за полудействие получает или теряет Incorporeal». Кнопка — запись kind:"script" на
// Черте; правило и флаг — rules/incorporeal.mjs. Полудействие списывается, если бой идёт.
import { canPhase, isIncorporealNow, PLANE_TOGGLE_FLAG } from "../rules/incorporeal.mjs";
import { spendActionPoints } from "../combat/action-economy.mjs";

export async function togglePhase(actor) {
  if (!actor || !canPhase(actor)) return ui.notifications.warn("Фаза: у персонажа нет такой Черты.");
  if (game.combat?.started && !(await spendActionPoints(actor, 1, { physical: false }))) {
    return ui.notifications.warn("Фаза: не хватает ОД (Полудействие).");
  }
  const now = isIncorporealNow(actor);
  const cur = !!(actor.flags?.["warhammer-dbc"]?.[PLANE_TOGGLE_FLAG] ?? actor.getFlag?.("warhammer-dbc", PLANE_TOGGLE_FLAG));
  await actor.setFlag("warhammer-dbc", PLANE_TOGGLE_FLAG, !cur);
  ui.notifications.info(now
    ? `${actor.name}: возвращается на материальный план — снова может атаковать и быть атакован.`
    : `${actor.name}: уходит на бестелесный план (+30 Скрытность, материальные не могут его атаковать).`);
}

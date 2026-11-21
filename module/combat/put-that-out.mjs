// module/combat/put-that-out.mjs
// Put That Out! / Гаси Это! (Талант Пилота; Разобрать jqrr4). Книга: «За полное действие
// персонаж может потушить Пожар в машине, получив 1 Усталости и 1d10 E(Fl) Dmg, игнорирующего
// броню.» Пожар машины состоянием не ведётся (combat/vehicle.mjs, тест детонации), поэтому
// кнопка гасит его карточкой: списывает полное действие, кладёт Усталость и урон.

import { esc } from "../helpers/utils.mjs";
import { itemHasName } from "../rules/predicates.mjs";
import { hasActionEconomy, canSpendActionPoints, spendActionPoints } from "./action-economy.mjs";

export function hasPutThatOut(actor) {
  return [...(actor?.items ?? [])].some(i => i?.type === "talent" && itemHasName(i, "Put That Out!"));
}

export async function usePutThatOut(actor) {
  if (!actor || !hasPutThatOut(actor)) return ui.notifications.warn("⚠️ У актора нет Таланта Гаси Это!.");
  if (hasActionEconomy(actor) && game.combat?.started) {
    if (!canSpendActionPoints(actor, 2, { physical: true })) return ui.notifications.warn(`⚠️ ${actor.name}: нужно полное действие.`);
    if (!await spendActionPoints(actor, 2, { physical: true })) return;
  }
  const roll = await new Roll("1d10").evaluate();
  await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), rolls: [roll],
    content: `<div class="wh-roll-result"><div class="roll-header">Гаси Это! — ${esc(actor.name)}</div>
      <div class="roll-threshold">Пожар в машине потушен. Цена: 1 Усталость и ${roll.total} E(Fl) урона без брони.</div></div>` });
  // Динамически: damage.mjs и лист тянут половину системы, кнопке они нужны только в момент клика.
  const { addFatigue } = await import("../sheets/tabs/conditions.mjs");
  const { applyDamageToActor } = await import("./damage.mjs");
  await addFatigue(actor, 1);
  await applyDamageToActor(actor, { rawDamage: roll.total, penetration: 0, damageType: "energy", damageSubtype: "flame",
    ignoreArmour: true, hitLocation: "Торс", weaponName: "Гаси Это!" });
  return roll.total;
}

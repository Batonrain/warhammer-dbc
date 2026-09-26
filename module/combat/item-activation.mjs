// module/combat/item-activation.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Включаемая способность — Foundry-обвязка над rules/item-activation.mjs.
//
//  • toggleItemActivation — кнопка «вкл./выкл.» на листе (Черты, Мутации):
//    проверяет и списывает ОД и цену в пуле ДО переключения, потом
//    пересобирает всё, что предмет выдаёт (эффекты, выданные Черты и
//    Таланты, интегральные атаки) — Клешня Слаангора появляется в списке
//    оружия и исчезает вместе с формой;
//  • endActivationsForCombat — конец боя гасит всё «до конца боя или сцены».
//    Сцены как отдельной сущности в системе нет — вне боя форму гасят кнопкой.
// ════════════════════════════════════════════════════════════════════════════

import { activationPlan, activationSpec, endsWithCombat } from "../rules/item-activation.mjs";
import { canSpendActionPoints, spendActionPoints } from "./action-economy.mjs";
import { capabilityCostGate, spendCapabilityCost } from "./capability-cost.mjs";
import { syncToggleChild } from "../apps/toggle-abilities.mjs";
import { postTestCard } from "../helpers/test-card.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { esc } from "../helpers/utils.mjs";

/** Переключить предмет и пересобрать его выдачи. */
async function setActive(item, on) {
  await item.update({ "system.active": !!on });
  await syncToggleChild(item);
}

/**
 * Нажатие тумблера. Не хватает ОД или Очков — ничего не меняется (гейт до
 * списания: сперва оба проверяются, потом оба тратятся).
 * @returns {Promise<boolean>} переключилось ли
 */
export async function toggleItemActivation(actor, item) {
  if (!actor || !item) return false;
  const plan = activationPlan(item);
  if (plan.ap && !canSpendActionPoints(actor, plan.ap)) {
    ui.notifications?.warn?.(`⚠️ ${actor.name}: «${item.name}» — не хватает ОД (нужно ${plan.ap}).`);
    return false;
  }
  if (plan.cost) {
    const gate = capabilityCostGate(actor, plan.cost);
    if (gate.disabled) { ui.notifications?.warn?.(`⚠️ ${item.name}: ${gate.title}`); return false; }
  }
  if (plan.ap && !(await spendActionPoints(actor, plan.ap))) return false;
  if (plan.cost && !(await spendCapabilityCost(actor, plan.cost, item.name))) return false;
  await setActive(item, plan.turnOn);
  // Простой тумблер (Босоногий: обут/босиком) в чат не пишет — только
  // способность с ценой действия или сроком.
  if (!plan.cost && (plan.ap || activationSpec(item).until)) {
    await postTestCard(actor, {
      icon: rollIcon("bolt", "#c98bff"),
      title: `${esc(item.name)} — ${esc(actor.name)}`,
      lines: [`<div class="roll-threshold">${plan.turnOn ? "Включено" : "Выключено"}.</div>`]
    }, { sound: false });
  }
  return true;
}

/** Конец боя: погасить всё, что держится «до конца боя или сцены». */
export async function endActivationsForCombat(combat) {
  const seen = new Set();
  for (const c of combat?.combatants ?? []) {
    const actor = c.actor;
    if (!actor || seen.has(actor.uuid)) continue;
    seen.add(actor.uuid);
    const ending = endsWithCombat(actor.items);
    for (const item of ending) await setActive(item, false);
    if (ending.length) {
      await postTestCard(actor, {
        icon: rollIcon("bolt", "#8fd0ff"),
        title: `${esc(actor.name)} — конец боя`,
        lines: [`<div class="roll-threshold">Выключено: ${ending.map(i => esc(i.name)).join(", ")}.</div>`]
      }, { sound: false });
    }
  }
}

// module/combat/emergency-maintenance.mjs
// ════════════════════════════════════════════════════════════════════════
//  Экстренное Обслуживание (Технодесантник) — Foundry-обвязка к
//  module/rules/emergency-maintenance.mjs. Зовёт её kind:"script" Черты
//  (кнопка «▶ Запустить», цена — 1 Очко Бесчестия, списывается ПОСЛЕ
//  успешного выполнения, apps/mechanics.mjs::runMechScriptEntry): отказ,
//  «нечего чинить» или нехватка ОД — throw, и Очко остаётся.
//
//  Чьи вещи: наведённой цели (союзник), иначе свои — книга не ограничивает
//  ремонт своим снаряжением, «снаряжения Легиона» — любого легионера.
// ════════════════════════════════════════════════════════════════════════

import { esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { postTestCard } from "../helpers/test-card.mjs";
import { canSpendActionPoints, spendActionPoints } from "./action-economy.mjs";
import {
  EMERGENCY_MAINTENANCE_AP, emergencyRepairCandidates, emergencyRepairPatch
} from "../rules/emergency-maintenance.mjs";

/** Окно выбора: что чинить. Возвращает ключ кандидата или null (отмена). */
async function pickRepair(owner, candidates) {
  const options = candidates.map(c => `<option value="${esc(c.key)}">${esc(c.label)}</option>`).join("");
  const res = await foundry.applications.api.DialogV2.wait({
    window: { title: `Экстренное Обслуживание — ${owner.name}` },
    classes: ["warhammer-dbc", "wh-holo"],
    content: `<p style="margin:4px 6px;">Очко Бесчестия и полное действие — починить повреждение, обычно требующее до 1 смены работы.</p>
      <div class="form-group"><select name="emRepair">${options}</select></div>`,
    rejectClose: false,
    buttons: [
      { action: "repair", label: "Починить", default: true,
        callback: (_e, button) => button.form.querySelector('select[name="emRepair"]')?.value || candidates[0].key },
      { action: "cancel", label: "Отмена" }
    ]
  });
  return (!res || res === "cancel") ? null : res;
}

/**
 * Кнопка Черты. Бросает Error, если починка не состоялась — тогда
 * runMechScriptEntry не списывает Очко Бесчестия.
 * @param {Actor} actor Технодесантник
 */
export async function emergencyMaintenance(actor) {
  if (!actor) throw new Error("Нет персонажа-владельца Черты.");
  const owner = [...(game.user?.targets ?? [])][0]?.actor ?? actor;
  const candidates = emergencyRepairCandidates(owner);
  if (!candidates.length) {
    throw new Error(`У «${owner.name}» нет повреждений, которые ведёт система (разъеденная броня, заклинившее/сломанное оружие, перегруженный щит).`);
  }
  if (!canSpendActionPoints(actor, EMERGENCY_MAINTENANCE_AP, { physical: true })) {
    throw new Error(`Не хватает Очков Действия (нужно ${EMERGENCY_MAINTENANCE_AP}, полное действие).`);
  }
  const key = await pickRepair(owner, candidates);
  if (!key) throw new Error("Отменено — Очко Бесчестия не потрачено.");
  const cand = candidates.find(c => c.key === key) ?? candidates[0];
  const patch = emergencyRepairPatch(owner, cand);
  if (!patch) throw new Error("Это повреждение система чинить не умеет.");
  if (!(await spendActionPoints(actor, EMERGENCY_MAINTENANCE_AP, { physical: true }))) {
    throw new Error("Не удалось списать Очки Действия.");
  }
  const doc = patch.target === "actor" ? owner : owner.items.get(patch.itemId);
  try { await doc.update(patch.update); } catch {
    throw new Error(`Нет прав на лист «${owner.name}» — попросите ГМа (Очко не потрачено).`);
  }
  await postTestCard(actor, {
    icon: rollIcon("wrench", "#6fe6ff"),
    title: `${esc(actor.name)} — Экстренное Обслуживание`,
    lines: [`<div class="roll-threshold">Полное действие: починено — <b>${esc(cand.label)}</b>${owner !== actor ? ` (${esc(owner.name)})` : ""}.</div>`]
  }, { sound: false });
}

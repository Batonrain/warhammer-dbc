// module/apps/tentacle-hand-form.mjs
//
// UI/действие субмутации 9 «Изменчивое» Мутации Tentacle/Щупальце (wdbc-2ynk).
// Кнопка на листе предмета — тот же приём, что apps/hand-of-death.mjs/
// apps/cancerous-healing.mjs: isXItem-гейт + HTML-функция + делегированный
// клик из item-sheet.mjs. Цена (1 Очко Бесчестия) списывается общим
// module/combat/capability-cost.mjs (wdbc-1dc8) — гейт «хватает ли» виден ДО
// клика тем же способом, что у «Возможностей сейчас» (sheet-helpers.mjs).

import { isTentacleShiftItem, tentacleIsHandForm, TENTACLE_HAND_FORM_FLAG }
  from "../rules/tentacle-hand-form.mjs";
import { capabilityCostLabel, capabilityCostGate, spendCapabilityCost }
  from "../combat/capability-cost.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { esc } from "../helpers/utils.mjs";

const SYSTEM = "warhammer-dbc";
const TO_HAND_COST = { pool: "infamy", amount: 1 };

export { isTentacleShiftItem };

/**
 * Переключить форму. В руку — полудействие, спишет цену (отменяется, если в
 * пуле не хватило); обратно в щупальце — свободное действие, бесплатно.
 */
export async function toggleTentacleHandForm(actor, item) {
  if (!isTentacleShiftItem(item) || !actor) return;
  const toHand = !tentacleIsHandForm(item);
  if (toHand) {
    const ok = await spendCapabilityCost(actor, TO_HAND_COST, "Щупальце → Рука (Изменчивое)");
    if (!ok) return;
  }
  await item.setFlag(SYSTEM, TENTACLE_HAND_FORM_FLAG, toHand);
}

/** Кнопка на листе предмета — пусто, если это не «Щупальце» со строкой 9. */
export function tentacleHandFormButtonHtml(item, actor) {
  if (!isTentacleShiftItem(item)) return "";
  const isHand = tentacleIsHandForm(item);
  const gate = actor ? capabilityCostGate(actor, TO_HAND_COST) : { disabled: true, title: "" };
  const btn = isHand
    ? `<button type="button" class="tentacle-hand-form-btn" data-item-id="${item.id}">
        ${rollIcon("bolt", "#c98bff")}Превратить обратно в щупальце (свободное действие)
      </button>`
    : `<button type="button" class="tentacle-hand-form-btn" data-item-id="${item.id}"
        ${gate.disabled ? "disabled" : ""} title="${esc(gate.title)}">
        ${rollIcon("bolt", "#c98bff")}Превратить в руку — ${esc(capabilityCostLabel(TO_HAND_COST))}, полудействие
      </button>`;
  return `<div class="tentacle-hand-form-panel">
    <div class="tentacle-hand-form-state">Сейчас: <b>${isHand ? "Рука" : "Щупальце"}</b></div>
    ${btn}
    <div class="tentacle-hand-form-hint">Пока в форме руки — бонус +20 на приём Захват не действует. Автоматический возврат при потере сознания не отслеживается — переключайте вручную.</div>
  </div>`;
}

// module/combat/surgical-precision.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Хирургическая Точность (Медик, medic.core.surgicalPrecision; 3-dc87):
//  кнопка в карточке Избирательной атаки по биологической цели — тест
//  Medicae−10 (против не-людей комбинированный, один бросок против меньшего
//  Предела) → +1 Dmg за каждый нечётный Успех. Прибавка правится в соседней
//  кнопке «Применить урон» и сохраняется в самом ChatMessage
//  (soulfire.mjs::persistDamageBoost) — урон применяет и ГМ, а перерисовка
//  карточки не должна её терять. Тест — раз на карточку (card-once.mjs):
//  иначе перерисовка возвращала кнопку и тест можно было повторять до успеха.
//  «Если атака убивает цель, можно парализовать вместо смерти» — решает стол,
//  система смерть цели до применения урона не знает.
//  Арифметика — rules/surgical-precision.mjs.
// ════════════════════════════════════════════════════════════════════════════

import { hasRuleFlag } from "../rules/flags.mjs";
import { SURGICAL_PRECISION_CAP } from "../rules/medic-talents.mjs";
import { SURGICAL_TARGETS, surgicalThreshold, oddSuccesses } from "../rules/surgical-precision.mjs";
import { postTestCard } from "../helpers/test-card.mjs";
import { runCardOnce } from "./card-once.mjs";
import { esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";

/** HTML кнопки в карточке Избирательной атаки (пусто, если условий нет). */
export function surgicalPrecisionButtonHtml(attacker, { selective, hit, attackerUuid = "" } = {}) {
  if (!selective || !hit || !hasRuleFlag(attacker, SURGICAL_PRECISION_CAP)) return "";
  return `<div class="roll-wprop-effects"><button class="wh-surgical-btn" type="button" data-attacker-uuid="${esc(attackerUuid)}"
    title="Хирургическая Точность: перед уроном одиночной Избирательной атаки по биологической цели — Medicae−10, +1 Dmg за каждый нечётный Успех. Если удар убивает — можно парализовать вместо смерти (решает стол).">
    🩺 Хирургическая Точность: тест Medicae−10 → +урон</button></div>`;
}

async function askTargetKind() {
  const options = Object.entries(SURGICAL_TARGETS)
    .map(([k, v]) => `<option value="${k}">${esc(v.label)}${v.lore ? ` — комбинированный с ${esc(v.lore.name)}−10` : ""}</option>`).join("");
  return foundry.applications.api.DialogV2.wait({
    window: { title: "Хирургическая Точность" },
    content: `<div class="atk-dlg-row"><label>Цель:</label><select id="sp-kind">${options}</select></div>`,
    rejectClose: false,
    buttons: [
      { action: "go", label: "Тест", default: true, callback: (ev, button) => button.form.querySelector("#sp-kind")?.value || "human" },
      { action: "cancel", label: "Отмена", callback: () => null }
    ]
  });
}

/** Отметка карточки «тест уже брошен» (card-once.mjs). */
export const SURGICAL_CARD_FLAG = "surgicalPrecisionUsed";

/**
 * Обработчик кнопки. `applyBtn` — соседняя .wh-apply-dmg-btn; `el` — сама
 * кнопка (гаснет после теста); `message` — карточка атаки. Возвращает
 * добавленный урон или null (тест не брошен).
 */
export async function runSurgicalPrecision(attacker, { applyBtn, el, message }) {
  if (!attacker?.isOwner) { ui.notifications?.warn("Хирургическая Точность: тест может бросить владелец атакующего (или ГМ)."); return null; }
  if (!hasRuleFlag(attacker, SURGICAL_PRECISION_CAP)) { ui.notifications?.warn(`${attacker.name}: нет Таланта «Хирургическая Точность».`); return null; }
  let added = null;
  await runCardOnce(message, SURGICAL_CARD_FLAG, async () => {
    added = await surgicalTest(attacker, { applyBtn, el });
    return added != null;
  }, "Хирургическую Точность с этой карточки уже бросали.");
  return added;
}

async function surgicalTest(attacker, { applyBtn, el }) {
  const kind = await askTargetKind();
  if (!kind) return null;

  const { threshold, parts } = surgicalThreshold(attacker, kind);
  const roll = await new Roll("1d100").evaluate();
  const success = roll.total <= threshold;
  const deg = Math.floor(Math.abs(threshold - roll.total) / 10) + 1;
  const bonus = oddSuccesses(deg, success);

  if (applyBtn && bonus > 0) {
    const total = (parseInt(applyBtn.dataset.damage) || 0) + bonus;
    applyBtn.dataset.damage = String(total);
    const label = applyBtn.querySelector("b");
    if (label) label.textContent = String(total);
    // Динамически: soulfire.mjs тянет sheets/tabs/psychic.mjs, а тот — combat/attack.mjs (импортирует этот файл).
    const { persistDamageBoost } = await import("./soulfire.mjs");
    await persistDamageBoost(applyBtn, { damage: total });
  }
  if (el) { el.disabled = true; el.textContent = success ? `🩺 Хирургическая Точность: +${bonus} урона` : "🩺 Хирургическая Точность: провал"; }

  await postTestCard(attacker, {
    icon: rollIcon("target", "#8fd0ff"), title: `Хирургическая Точность — ${esc(attacker.name)}`,
    threshold: `<div class="roll-threshold">${esc(SURGICAL_TARGETS[kind].label)}: ${esc(parts.join(" / "))} → Предел <b>${threshold}</b>, бросок <b>${roll.total}</b> — ${
      success ? `<span class="roll-success">Успех (${deg}): +${bonus} Dmg за нечётные Успехи</span>` : `<span class="roll-failure">Провал</span>`}
      ${success ? "<br/>Если эта атака убивает цель, можно парализовать её вместо смерти." : ""}</div>`
  }, { rolls: [roll], sound: true });
  return success ? bonus : 0;
}

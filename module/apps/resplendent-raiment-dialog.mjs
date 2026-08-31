// module/apps/resplendent-raiment-dialog.mjs
// ════════════════════════════════════════════════════════════════════════
//  Диалог «Блистательные Одеяния» (wdbc-sk8s) — выбор, кого кастер
//  сознательно исключает из эффекта (module/combat/resplendent-raiment.mjs).
// ════════════════════════════════════════════════════════════════════════

import { esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { applyResplendentRaiment } from "../combat/resplendent-raiment.mjs";

export async function showResplendentRaimentDialog(caster) {
  const casterToken = caster.getActiveTokens?.(true, true)?.[0] ?? null;
  if (!casterToken) return ui.notifications.warn("У актора нет токена на текущей сцене.");

  const others = (casterToken.parent?.tokens?.contents ?? [])
    .filter(t => t.actor && t.id !== casterToken.id);

  const content = `
    <div class="wh-wizard-form" style="padding:6px;">
      <div class="atk-dlg-header"><span class="atk-weapon-name">${rollIcon("crown", "#e08aff")}Блистательные Одеяния</span></div>
      <div style="font-size:0.85em;color:#8a8a8a;margin-bottom:6px;">Все на сцене, кроме отмеченных ниже (сознательно исключённых), проходят тест W−30.</div>
      ${others.length ? `<div class="grant-spec-choice-list">${others.map(t => `
        <label class="grant-spec-choice-row"><input type="checkbox" class="rr-exclude" value="${t.id}"/> ${esc(t.actor.name)}</label>
      `).join("")}</div>` : `<div><i>Больше никого на сцене</i></div>`}
    </div>`;

  return foundry.applications.api.DialogV2.wait({
    window: { title: "Блистательные Одеяния" },
    classes: ["wh-attack-dialog", "warhammer-dbc"],
    position: { width: 380 },
    content,
    rejectClose: false,
    buttons: [
      {
        action: "go", label: "Применить", icon: "fas fa-crown", default: true,
        callback: async (event, button) => {
          const excluded = new Set([...button.form.querySelectorAll(".rr-exclude:checked")].map(el => el.value));
          await applyResplendentRaiment(caster, casterToken, excluded);
        }
      },
      { action: "cancel", label: "Отмена" }
    ]
  }).then(res => res === false ? null : res);
}

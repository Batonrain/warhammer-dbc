// module/apps/dread-wail-dialog.mjs
// ════════════════════════════════════════════════════════════════════════
//  Диалог «Грозный Вопль» (wdbc-sk8s) — выбор одной из двух веток
//  (module/combat/dread-wail.mjs): усиление звукового оружия, либо
//  звуковая волна (с выбором ОДНОГО эффекта на всех провалившихся).
// ════════════════════════════════════════════════════════════════════════

import { esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { applyDreadWailWeaponBuff, applyDreadWailWave, WAVE_EFFECTS } from "../combat/dread-wail.mjs";

export async function showDreadWailDialog(actor) {
  // getActiveTokens(linked, document) — второй true отдаёт TokenDocument
  // напрямую (parent=сцена), то, что нужно tokensWithinRadius (aoe-target.mjs).
  const casterToken = actor.getActiveTokens?.(false, true)?.[0] ?? null;

  const content = `
    <div class="wh-wizard-form" style="padding:6px;">
      <div class="atk-dlg-header"><span class="atk-weapon-name">${rollIcon("bolt", "#c98bff")}Грозный Вопль</span></div>
      <div class="atk-dlg-row"><label>Ветка:</label>
        <select id="dw-branch">
          <option value="weapon">Усилить звуковое оружие (Dmg/Pen)</option>
          <option value="wave">Звуковая волна (AoE)</option>
        </select>
      </div>
      <div class="atk-dlg-row" id="dw-effect-row">
        <label>Эффект волны:</label>
        <select id="dw-effect">
          ${WAVE_EFFECTS.map(e => `<option value="${e.key}">${esc(e.label)}</option>`).join("")}
        </select>
      </div>
      <div style="font-size:0.82em;color:#8a8a8a;margin-top:6px;">Волна: радиус ½ Cor.b м от вашего токена на сцене, не задевает посвящённых Слаанеш. Каждая цель проходит W−20; при провале получает выбранный эффект.</div>
    </div>`;

  return foundry.applications.api.DialogV2.wait({
    window: { title: "Грозный Вопль" },
    classes: ["wh-attack-dialog", "warhammer-dbc"],
    position: { width: 400 },
    content,
    rejectClose: false,
    render: (event, dialog) => {
      const form = dialog.element.querySelector("form");
      const branchEl = form.querySelector("#dw-branch");
      const effectRow = form.querySelector("#dw-effect-row");
      const sync = () => { effectRow.style.display = branchEl.value === "wave" ? "" : "none"; };
      branchEl.addEventListener("change", sync);
      sync();
    },
    buttons: [
      {
        action: "go", label: "Применить", icon: "fas fa-bolt", default: true,
        callback: async (event, button) => {
          const form = button.form;
          const branch = form.querySelector("#dw-branch")?.value;
          if (branch === "weapon") {
            await applyDreadWailWeaponBuff(actor);
            return;
          }
          if (!casterToken) return ui.notifications.warn("У актора нет токена на текущей сцене — волну не от чего мерить.");
          const effectKey = form.querySelector("#dw-effect")?.value || "stunned";
          await applyDreadWailWave(actor, casterToken, effectKey);
        }
      },
      { action: "cancel", label: "Отмена" }
    ]
  }).then(res => res === false ? null : res);
}

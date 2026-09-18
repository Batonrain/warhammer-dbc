// module/combat/force-move-menu.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Единая точка входа на лист/Token HUD для трёх смежных правил стр. 27:
//  Через Силу / Массивные Предметы (свой токен, force-move.mjs), Против
//  Техники (свой токен + отмеченная цель как пилот, vehicle-force-move.mjs),
//  Совместное Перемещение (свой токен как ведущий + отмеченные цели как
//  ассистенты, joint-move.mjs). Один диалог вместо трёх кнопок — три сценария
//  делят одни и те же поля (Способ, Размер), различаются только тем, ЧТО
//  выбрано на сцене (ничего — соло, одна цель — Техника, несколько — Совместно).
// ════════════════════════════════════════════════════════════════════════════

import { useForceMove } from "./force-move.mjs";
import { useVehiclePushContest } from "./vehicle-force-move.mjs";
import { useJointMove } from "./joint-move.mjs";

function targetedActors() {
  return [...(game.user?.targets ?? [])].map(t => t.actor).filter(Boolean);
}

export function showForceMoveMenu(actor) {
  if (!actor) return;
  const targets = targetedActors();
  const modeOptions = `
    <option value="lift">Подъём/Переворот (до 2м)</option>
    <option value="push">Толкание (до SPD)</option>`;

  let scenarioNote, scenarioFields, onSubmit;
  if (targets.length === 1) {
    // Против Техники: единственная отмеченная цель — пилот.
    const pilot = targets[0];
    scenarioNote = `Против Техники (стр. 27): встречный тест против ${pilot.name} (Operate(A)+20).`;
    scenarioFields = `
      <div class="atk-dlg-row"><label>Разница в Размерах (техника − вы)</label>
        <input type="number" id="fm-size" value="0" min="0" step="1"/></div>`;
    onSubmit = (html) => {
      const mode = html.querySelector("#fm-mode").value;
      const sizeDiff = parseInt(html.querySelector("#fm-size").value) || 0;
      useVehiclePushContest(actor, pilot, { mode, sizeDiff });
    };
  } else if (targets.length > 1) {
    // Совместное Перемещение: несколько отмеченных целей — ассистенты.
    scenarioNote = `Совместное Перемещение (стр. 27): ведущий — вы, ассистентов — ${targets.length}. Захват цели и очерёдность Ходов книга требует пройти ДО этого броска — ведите вручную.`;
    scenarioFields = `
      <div class="atk-dlg-row"><label>Вес предмета (кг)</label>
        <input type="number" id="fm-weight" value="0" min="0" step="1"/></div>`;
    onSubmit = (html) => {
      const mode = html.querySelector("#fm-mode").value;
      const weight = parseFloat(html.querySelector("#fm-weight").value) || 0;
      useJointMove(actor, targets, { mode, weight });
    };
  } else {
    // Соло: Через Силу / Массивные Предметы.
    scenarioNote = `Через Силу / Массивные Предметы (стр. 27). Отметьте технику (1 цель) для встречного теста, или несколько союзников для Совместного Перемещения.`;
    scenarioFields = `
      <div class="atk-dlg-row"><label>Разница в Размерах (предмет − вы, 0 — не массивный)</label>
        <input type="number" id="fm-size" value="0" min="0" step="1"/></div>
      <div class="atk-dlg-row"><label><input type="checkbox" id="fm-through-force" checked/> Через Силу (за пределами весового лимита — Полное действие, обе руки)</label></div>`;
    onSubmit = (html) => {
      const mode = html.querySelector("#fm-mode").value;
      const sizeDiff = parseInt(html.querySelector("#fm-size").value) || 0;
      const throughForce = html.querySelector("#fm-through-force").checked;
      useForceMove(actor, { mode, sizeDiff, throughForce });
    };
  }

  new Dialog({
    title: "Через Силу",
    content: `
      <div class="atk-range-info" style="font-size:0.85em;padding:4px 2px;">${scenarioNote}</div>
      <div class="atk-dlg-row"><label>Способ</label><select id="fm-mode">${modeOptions}</select></div>
      ${scenarioFields}`,
    buttons: {
      roll: { label: "Бросок", callback: (html) => onSubmit(html instanceof HTMLElement ? html : html[0]) },
      cancel: { label: "Отмена" }
    },
    default: "roll"
  }, { classes: ["dialog", "wh-attack-dialog"], width: 360 }).render(true);
}

const FORCE_MOVE_EXCLUDED_TYPES = ["vehicle", "ship", "horde", "squad", "formation", "starSystem"];

/** Кнопка Token HUD — «Через Силу» на СВОЁМ токене (по образцу initMovementActionsHud). */
export function initForceMoveHud() {
  Hooks.on("renderTokenHUD", (hud, html) => {
    const actor = hud.object?.document?.actor;
    if (!actor || FORCE_MOVE_EXCLUDED_TYPES.includes(actor.type)) return;
    if (!actor.isOwner && !game.user.isGM) return;

    const el = html instanceof HTMLElement ? html : html?.[0];
    if (!el) return;
    const col = el.querySelector(".col.left") || el.querySelector(".col-left")
             || el.querySelector(".left") || el;
    if (el.querySelector(".wh-force-move-btn")) return;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "control-icon wh-force-move-btn";
    btn.title = "Через Силу / Против Техники / Совместное Перемещение (стр. 27)";
    btn.innerHTML = `<i class="fas fa-weight-hanging"></i>`;
    btn.addEventListener("click", ev => {
      ev.preventDefault();
      ev.stopPropagation();
      showForceMoveMenu(actor);
    });
    col.appendChild(btn);
  });
}

// module/apps/wraithbone-song-dialog.mjs
// ════════════════════════════════════════════════════════════════════════
//  Общий диалог для Bone Song/Preservation/Song of Swiftness (Певцы Кости,
//  wdbc-sk8s) — все три делят один и тот же выбор режима: «одна техника
//  (наведённый таргет)» ИЛИ «вся техника в радиусе 10 м от каст-токена»
//  (module/rules/aoe-target.mjs::tokensWithinRadius). Одиночная цель — по
//  прецеденту avatar-of-slaughter.mjs/dread-wail.mjs (game.user.targets),
//  без отдельной проверки дальности W м (движок не мерит её так же, как не
//  мерит её у прочих ручных способностей этого типа — решение игрока/ГМа).
// ════════════════════════════════════════════════════════════════════════

import { esc } from "../helpers/utils.mjs";

/**
 * @param {Actor} actor
 * @param {{title:string, icon:string, applySingle:Function, applyArea:Function}} opts
 *   applySingle(actor, targetActor), applyArea(actor, casterToken) — вызывающие функции ветки.
 */
export async function showWraithboneSongDialog(actor, { title, applySingle, applyArea }) {
  const casterToken = actor.getActiveTokens?.(true, true)?.[0] ?? null;

  const content = `
    <div class="wh-wizard-form" style="padding:6px;">
      <div class="atk-dlg-header"><span class="atk-weapon-name">${esc(title)}</span></div>
      <div class="atk-dlg-row"><label>Режим:</label>
        <select id="ws-branch">
          <option value="single">Одна техника (наведите таргет T)</option>
          <option value="area">Вся техника в радиусе 10 м</option>
        </select>
      </div>
      <div style="font-size:0.82em;color:#8a8a8a;margin-top:6px;">Одиночная цель — берётся текущий таргет (T) на сцене; дальность W м не проверяется движком, решение за столом. Область — все токены техники в радиусе 10 м от вашего токена на сцене.</div>
    </div>`;

  return foundry.applications.api.DialogV2.wait({
    window: { title },
    classes: ["wh-attack-dialog", "warhammer-dbc"],
    position: { width: 400 },
    content,
    rejectClose: false,
    buttons: [
      {
        action: "go", label: "Применить", icon: "fas fa-music", default: true,
        callback: async (event, button) => {
          const form = button.form;
          const branch = form.querySelector("#ws-branch")?.value;
          if (branch === "single") {
            const target = [...(game.user?.targets ?? [])][0]?.actor ?? null;
            if (!target) return ui.notifications.warn("Наведите таргет (T) на технику.");
            if (target.type !== "vehicle") return ui.notifications.warn("Цель должна быть техникой.");
            await applySingle(actor, target);
            return;
          }
          if (!casterToken) return ui.notifications.warn("У актора нет токена на текущей сцене — область не от чего мерить.");
          await applyArea(actor, casterToken);
        }
      },
      { action: "cancel", label: "Отмена" }
    ]
  }).then(res => res === false ? null : res);
}

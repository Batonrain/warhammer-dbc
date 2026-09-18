// module/combat/tear-open.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Разорвать (стр. 27): если S.b+T.b персонажа БОЛЬШЕ АР укрытия, двери,
//  стены здания или соответствующей стороны техники, он может за полудействие
//  вырвать из неё кусок — сравнение чисел, без броска. Если своих S.b+T.b не
//  хватает, персонаж может расширить действие до Полного и пройти тест
//  Athletics(S)+0: каждый Успех даёт +1 к S.b+T.b В РАСЧЁТЕ ЭТОГО Разрыва
//  (временно, не постоянно) — тот же приём эскалации, что у Через Силу
//  (combat/force-move.mjs). 2+ Провала — 1 Усталости, тем же правилом, что
//  Через Силу/Массивные Предметы.
//
//  АР цели вводится вручную (укрытие/дверь/стена/борт техники — числа уже
//  существуют в системе по отдельности: system.cover.ap, AP брони техники по
//  сторонам, — но единого «текущая цель под прицелом имеет столько-то АР»
//  здесь нет, вводит пользователь).
// ════════════════════════════════════════════════════════════════════════════

import { spendActionPoints } from "./action-economy.mjs";
import { collectTestMods } from "../rules/roll-mods.mjs";
import { testOutcome } from "../rules/roll-outcome.mjs";
import { addFatigue } from "../sheets/tabs/conditions.mjs";
import { esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { postTestCard, rollStatLine, outcomeHtml } from "../helpers/test-card.mjs";

/** S.b + T.b актора — база сравнения с АР цели (стр. 27). */
export function sbPlusTb(actor) {
  const s = Number(actor?.system?.characteristics?.s?.bonus) || 0;
  const t = Number(actor?.system?.characteristics?.t?.bonus) || 0;
  return s + t;
}

/**
 * Разорвать. `extended:false` (по умолчанию) — попытка за полудействие: чисто
 * сравнение S.b+T.b с АР цели, без броска; хватает — сразу успех, не хватает —
 * предупреждение (без списания ОД: попытка не состоялась, а не провалилась).
 * `extended:true` — Полное действие + тест Athletics(S)+0, +1 S.b+T.b за
 * Успех для ЭТОГО сравнения, 2+ Провала → 1 Усталости.
 */
export async function useTearOpen(actor, { targetAP = 0, targetLabel = "цель", extended = false } = {}) {
  if (!actor) return;
  const sbtb = sbPlusTb(actor);

  if (!extended) {
    if (sbtb <= targetAP) {
      return ui.notifications.warn(
        `${actor.name}: S.b+T.b (${sbtb}) не больше АР ${targetLabel} (${targetAP}) — за полудействие не вырвать. `
        + `Можно расширить до Полного действия с тестом Athletics(S)+0.`);
    }
    if (!await spendActionPoints(actor, 1, { physical: true })) {
      return ui.notifications.warn("⚠️ Не хватает ОД на полудействие.");
    }
    await postTestCard(actor, {
      icon: rollIcon("wrench", "#c0a0ff"),
      title: `${esc(actor.name)} — Разорвать: ${esc(targetLabel)}`,
      lines: [`<div class="roll-threshold">S.b+T.b <b>${sbtb}</b> &gt; АР <b>${targetAP}</b> — вырвано без броска (полудействие).</div>`]
    }, { sound: false });
    return;
  }

  if (!await spendActionPoints(actor, 2, { physical: true })) {
    return ui.notifications.warn("⚠️ Не хватает ОД на Полное действие.");
  }
  const athletics = actor.system?.skills?.athletics?.total ?? -20;
  const ruleMods = collectTestMods(actor, { kind: "skill", skill: "athletics", char: "s" });
  const threshold = athletics + ruleMods.total;

  const roll = await new Roll("1d100").evaluate();
  const rv = roll.total;
  const { success, deg } = testOutcome(rv, threshold);
  if (!success && deg >= 2) await addFatigue(actor, 1);

  const boostedSbTb = sbtb + (success ? deg : 0);
  const torn = boostedSbTb > targetAP;
  const dice = await roll.render();

  await postTestCard(actor, {
    icon: rollIcon("wrench", "#c0a0ff"),
    title: `${esc(actor.name)} — Разорвать (Полное действие): ${esc(targetLabel)}`,
    threshold: rollStatLine({ label: "Athletics(S)", base: athletics, parts: ruleMods.parts, threshold, rv }),
    outcome: torn
      ? outcomeHtml(true, `Вырвано — S.b+T.b ${sbtb}${success ? ` +${deg} (Успехи)` : ""} = ${boostedSbTb} &gt; АР ${targetAP}`)
      : outcomeHtml(false, `Не вырвано — ${boostedSbTb} ≤ АР ${targetAP}${!success && deg >= 2 ? " (2+ Провала — 1 Усталость)" : ""}`),
    sections: [`<details class="roll-dice-details"><summary>${rollIcon("chart", "#8fd0ff")}Показать кубы</summary>${dice}</details>`]
  }, { rolls: [roll] });
}

function showTearOpenMenu(actor) {
  new Dialog({
    title: "Разорвать",
    content: `
      <div class="atk-range-info" style="font-size:0.85em;padding:4px 2px;">
        S.b+T.b: <b>${sbPlusTb(actor)}</b>. Разорвать (стр. 27): S.b+T.b &gt; АР цели — полудействие без броска.
      </div>
      <div class="atk-dlg-row"><label>АР цели (укрытие/дверь/стена/борт техники)</label>
        <input type="number" id="to-ap" value="0" min="0" step="1"/></div>
      <div class="atk-dlg-row"><label>Название цели</label>
        <input type="text" id="to-label" value="укрытие"/></div>
      <div class="atk-dlg-row"><label><input type="checkbox" id="to-extended"/> Расширить до Полного действия — тест Athletics(S)+0, +1 S.b+T.b за Успех, 2+ Провала — 1 Усталости</label></div>`,
    buttons: {
      roll: {
        label: "Разорвать",
        callback: (html) => {
          const el = html instanceof HTMLElement ? html : html[0];
          const targetAP = parseInt(el.querySelector("#to-ap").value) || 0;
          const targetLabel = el.querySelector("#to-label").value || "цель";
          const extended = el.querySelector("#to-extended").checked;
          useTearOpen(actor, { targetAP, targetLabel, extended });
        }
      },
      cancel: { label: "Отмена" }
    },
    default: "roll"
  }, { classes: ["dialog", "wh-attack-dialog"], width: 340 }).render(true);
}

const TEAR_OPEN_EXCLUDED_TYPES = ["vehicle", "ship", "horde", "squad", "formation", "starSystem"];

/** Кнопка Token HUD — «Разорвать» на СВОЁМ токене (по образцу initMovementActionsHud). */
export function initTearOpenHud() {
  Hooks.on("renderTokenHUD", (hud, html) => {
    const actor = hud.object?.document?.actor;
    if (!actor || TEAR_OPEN_EXCLUDED_TYPES.includes(actor.type)) return;
    if (!actor.isOwner && !game.user.isGM) return;

    const el = html instanceof HTMLElement ? html : html?.[0];
    if (!el) return;
    const col = el.querySelector(".col.left") || el.querySelector(".col-left")
             || el.querySelector(".left") || el;
    if (el.querySelector(".wh-tear-open-btn")) return;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "control-icon wh-tear-open-btn";
    btn.title = "Разорвать (стр. 27)";
    btn.innerHTML = `<i class="fas fa-door-open"></i>`;
    btn.addEventListener("click", ev => {
      ev.preventDefault();
      ev.stopPropagation();
      showTearOpenMenu(actor);
    });
    col.appendChild(btn);
  });
}

// module/sheets/tabs/pain.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Очки Боли Друкхари: впитать/потратить и поглотить варп-урон Болью.
//  Функции принимают актора, а не лист.
// ════════════════════════════════════════════════════════════════════════════

import { rollIcon } from "../../constants/roll-icons.mjs";
import { computeWoundDamage } from "./wounds.mjs";

/** Краткое сообщение о Боли в чат. */
export async function painChatMsg(actor, text) {
  await ChatMessage.create(ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="wh-roll-result"><div class="roll-header">${rollIcon("bolt","#c98bff")}Очки Боли — ${actor.name}</div><div class="roll-threshold">${text}</div></div>`
  }, game.settings.get("core", "rollMode")));
}

/** Впитать (+1) или потратить (-1) Очко Боли. */
export async function painChange(actor, delta, kind) {
  const cur = actor.system.fate?.value ?? 0;
  const max = actor.system.fate?.max ?? 0;
  if (delta > 0 && cur >= max) {
    ui.notifications.info(`Очки Боли уже на максимуме (${max}).`);
    return;
  }
  if (delta < 0 && cur <= 0) {
    ui.notifications.info("Нет Очков Боли для траты.");
    return;
  }
  const next = Math.max(0, Math.min(max, cur + delta));
  await actor.update({ "system.fate.value": next });
  await painChatMsg(actor, kind === "absorb"
    ? `＋ Впитана <b>1</b> Боль (Реакция). Текущая Боль: <b>${next}</b> / ${max}.`
    : `− Потрачена <b>1</b> Боль. Осталось: <b>${next}</b> / ${max}.`);
}

/** Выжигание Души / Варп-урон: Боль выжигается первой (3 урона за 1 Боль). */
export function openPainSoulBurnDialog(actor) {
  const content = `
    <form class="wh-wizard-form" style="padding:6px;">
      <div class="atk-dlg-header"><span class="atk-weapon-name">🔥 Выжигание Души / Варп-урон</span></div>
      <div class="atk-dlg-row"><label>Входящий урон:</label><input type="number" id="pain-sb-dmg" value="0" min="0" style="width:70px;"/></div>
      <div class="roll-threshold" style="font-size:0.82em;color:#5a4a30;">Боль выжигается первой: 1 Боль поглощает 3 урона. Остаток уходит в Раны.</div>
    </form>`;
  new Dialog({
    title: "Поглощение Болью",
    content,
    buttons: {
      go: {
        icon: '<i class="fas fa-fire"></i>',
        label: "Поглотить",
        callback: async html => {
          const dmg = Math.max(0, parseInt(html.find("#pain-sb-dmg").val()) || 0);
          if (!dmg) return;
          const cur = actor.system.fate?.value ?? 0;
          const painUsed = Math.min(cur, Math.ceil(dmg / 3));
          const absorbed = Math.min(dmg, painUsed * 3);
          const remaining = dmg - absorbed;
          const updates = { "system.fate.value": cur - painUsed };
          if (remaining > 0) Object.assign(updates, computeWoundDamage(actor.system, remaining));
          await actor.update(updates);
          const lines = [
            `Входящий урон: <b>${dmg}</b>`,
            `${rollIcon("fire","#ff8a3a")}Выжжено Боли: <b>${painUsed}</b> → поглощено <b>${absorbed}</b> урона`,
            remaining > 0 ? `${rollIcon("blood","#ff6b6b")}В Раны: <b>${remaining}</b>` : "Урон полностью поглощён Болью",
            `Осталось Боли: <b>${cur - painUsed}</b> / ${actor.system.fate?.max ?? 0}`
          ];
          await painChatMsg(actor, lines.join("<br/>"));
        }
      },
      cancel: { label: "Отмена" }
    },
    default: "go"
  }, { classes: ["dialog", "wh-attack-dialog"], width: 380 }).render(true);
}

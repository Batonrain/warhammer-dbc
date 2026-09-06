// module/sheets/tabs/pain.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Очки Боли Друкхари: впитать/потратить и поглотить варп-урон Болью.
//  Функции принимают актора, а не лист.
// ════════════════════════════════════════════════════════════════════════════

import { rollIcon } from "../../constants/roll-icons.mjs";
import { woundLossUpdates } from "../../rules/wounds.mjs";
import { esc } from "../../helpers/utils.mjs";

/**
 * Краткое сообщение о Боли в чат. Не карточка теста: ни броска, ни Порога,
 * ни исхода — просто учёт «впитал/потратил». На общий сборщик
 * helpers/test-card.mjs сознательно не переведено (wdbc-kuun), как и прочие
 * уведомления системы.
 */
export async function painChatMsg(actor, text) {
  await ChatMessage.create(ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="wh-roll-result"><div class="roll-header">${rollIcon("bolt","#c98bff")}Очки Боли — ${esc(actor.name)}</div><div class="roll-threshold">${text}</div></div>`
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
  const text = kind === "absorb"
    ? `＋ Впитана <b>1</b> Боль (Реакция). Текущая Боль: <b>${next}</b> / ${max}.`
    : kind === "enjoyment"
      ? `＋ Получена <b>1</b> Боль (Наслаждение, без траты Реакции). Текущая Боль: <b>${next}</b> / ${max}.`
      : `− Потрачена <b>1</b> Боль. Осталось: <b>${next}</b> / ${max}.`;
  await painChatMsg(actor, text);
}

/**
 * Выжигание Души / Варп-урон: Боль выжигается первой (3 урона за 1 Боль),
 * остаток — в Раны обычным путём. Общая логика для ручного диалога
 * (openPainSoulBurnDialog) и кнопки «Поглотить Болью» прямо в карточке урона
 * (wdbc-7as8) — оба передают уже известное число, не пересчитывают его.
 */
export async function absorbPainDamage(actor, dmg) {
  dmg = Math.max(0, parseInt(dmg) || 0);
  if (!dmg) return;
  const cur = actor.system.fate?.value ?? 0;
  const painUsed = Math.min(cur, Math.ceil(dmg / 3));
  const absorbed = Math.min(dmg, painUsed * 3);
  const remaining = dmg - absorbed;
  const updates = { "system.fate.value": cur - painUsed };
  if (remaining > 0) Object.assign(updates, woundLossUpdates(actor.system, remaining));
  await actor.update(updates);
  const lines = [
    `Входящий урон: <b>${dmg}</b>`,
    `${rollIcon("fire","#ff8a3a")}Выжжено Боли: <b>${painUsed}</b> → поглощено <b>${absorbed}</b> урона`,
    remaining > 0 ? `${rollIcon("blood","#ff6b6b")}В Раны: <b>${remaining}</b>` : "Урон полностью поглощён Болью",
    `Осталось Боли: <b>${cur - painUsed}</b> / ${actor.system.fate?.max ?? 0}`
  ];
  await painChatMsg(actor, lines.join("<br/>"));
}

/** Выжигание Души / Варп-урон: диалог ручного ввода числа (fallback без карточки под рукой). */
export function openPainSoulBurnDialog(actor, defaultDmg = 0) {
  const content = `
    <form class="wh-wizard-form" style="padding:6px;">
      <div class="atk-dlg-header"><span class="atk-weapon-name">🔥 Выжигание Души / Варп-урон</span></div>
      <div class="atk-dlg-row"><label>Входящий урон:</label><input type="number" id="pain-sb-dmg" value="${Math.max(0, parseInt(defaultDmg) || 0)}" min="0" style="width:70px;"/></div>
      <div class="roll-threshold" style="font-size:0.82em;color:#5a4a30;">Боль выжигается первой: 1 Боль поглощает 3 урона. Остаток уходит в Раны.</div>
    </form>`;
  new Dialog({
    title: "Поглощение Болью",
    content,
    buttons: {
      go: {
        icon: '<i class="fas fa-fire"></i>',
        label: "Поглотить",
        callback: html => absorbPainDamage(actor, parseInt(html.find("#pain-sb-dmg").val()) || 0)
      },
      cancel: { label: "Отмена" }
    },
    default: "go"
  }, { classes: ["dialog", "wh-attack-dialog"], width: 380 }).render(true);
}

// module/apps/daemonblood.mjs
//
// UI/действие психосилы «Daemonblood / Кровь Демонов» (wdbc-173l) — см.
// module/rules/daemonblood.mjs про арифметику. Кнопка на листе психосилы:
// диалог выбора 1×/2×/3×PR (обрезано запасом живых Ран), одноразово (кнопка
// скрывается, пока флаг DAEMONBLOOD_FLAG > 0 — переоформление вклада без
// сброса флага не предусмотрено интерфейсом, тем же приёмом, что Cancerous
// Healing/Flayed).

import { isDaemonbloodItem, daemonbloodOptions, daemonbloodGrant, DAEMONBLOOD_FLAG,
         daemonbloodShrinkToFit } from "../rules/daemonblood.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { postTestCard } from "../helpers/test-card.mjs";

export { isDaemonbloodItem };

const FLAG = "warhammer-dbc";

/**
 * Ресинк ПОСЛЕ того, как общий ablative пул уменьшился по другой причине
 * (поглощение урона) — вызывать из хука updateActor при изменении
 * system.wounds.ablative ЛЮБОГО актора (см. flayed.mjs про ту же причину).
 */
export async function reconcileDaemonbloodToFit(actor) {
  const prev = Number(actor.getFlag(FLAG, DAEMONBLOOD_FLAG)) || 0;
  if (prev <= 0) return;
  const result = daemonbloodShrinkToFit(actor.system, prev);
  if (!result) return;
  await actor.update({
    "system.wounds.ablativeMax": result.ablativeMax,
    [`flags.${FLAG}.${DAEMONBLOOD_FLAG}`]: result.contribution
  });
}

async function promptAmount(options) {
  const rows = options.map(o => `
    <label class="atk-dlg-row" style="display:block;">
      <input type="radio" name="db-amount" value="${o.amount}" ${o === options[0] ? "checked" : ""}/>
      ${o.mult}×PR = <b>${o.wanted}</b> крови${o.capped ? ` (обрезано запасом Ран до <b>${o.amount}</b>)` : ""}
    </label>`).join("");
  const content = `<div class="wh-attack-form">
    <div class="atk-dlg-header"><span class="atk-weapon-name">Daemonblood</span><span class="atk-weapon-class">Кровавая Жертва</span></div>
    ${rows}
    <div class="sq-hint">Тратит выбранное число живых Ран, выдаёт столько же аблативных.</div>
  </div>`;
  return foundry.applications.api.DialogV2.wait({
    window: { title: "Daemonblood: Кровавая Жертва" },
    classes: ["warhammer-dbc", "wh-holo", "wh-attack-dialog"],
    content,
    rejectClose: false,
    buttons: [
      {
        action: "ok", label: "Пролить кровь", icon: "fas fa-tint", default: true,
        callback: (event, button) => Number(button.form.querySelector('input[name="db-amount"]:checked')?.value) || 0
      },
      { action: "cancel", label: "Отмена", callback: () => null }
    ]
  });
}

/** Нажатие кнопки на листе психосилы. */
export async function useDaemonblood(actor, item) {
  if (!isDaemonbloodItem(item) || !actor) return;
  const prevContribution = Number(actor.getFlag(FLAG, DAEMONBLOOD_FLAG)) || 0;
  if (prevContribution > 0) {
    ui.notifications?.info("Жертва уже принесена в этом бою — аблативный пул уже несёт вклад Daemonblood.");
    return;
  }
  const pr = Number(actor.system?.psyker?.rating) || 0;
  const currentWounds = Number(actor.system?.wounds?.value) || 0;
  const options = daemonbloodOptions(pr, currentWounds);
  if (!options.length) {
    ui.notifications?.warn(pr <= 0
      ? "Нет Пси-Рейтинга — нечем масштабировать жертву."
      : "Не осталось живых Ран, чтобы пролить кровь.");
    return;
  }

  const amount = await promptAmount(options);
  if (!amount) return; // отменено

  const { wounds, critical, ablative, ablativeMax, contribution } =
    daemonbloodGrant(actor.system, prevContribution, amount);
  await actor.update({
    "system.wounds.value": wounds,
    "system.wounds.critical": critical,
    "system.wounds.ablative": ablative,
    "system.wounds.ablativeMax": ablativeMax,
    [`flags.${FLAG}.${DAEMONBLOOD_FLAG}`]: contribution
  });

  // Результат нажатия кнопки, а не тест: броска и Порога нет, звука тоже.
  await postTestCard(actor, {
    icon: rollIcon("blood", "#8b1a1a"),
    title: "Daemonblood — Кровавая Жертва",
    lines: [
      `<div class="roll-threshold">Пролито крови: <b>${amount}</b> → аблативные Раны <b>${ablative}</b></div>`,
      `<div class="roll-threshold" style="opacity:.8;">Пока действует: Daemonic (+½PR окр.▲) против попаданий по защищённым бронёй зонам — не смоделировано, отыгрывать вручную.</div>`
    ]
  }, { sound: false });
}

/** Кнопка на листе предмета — пусто, если это не Daemonblood, нет актора, или жертва уже принесена. */
export function daemonbloodButtonHtml(item, actor) {
  if (!isDaemonbloodItem(item) || !actor) return "";
  const contribution = Number(actor.getFlag(FLAG, DAEMONBLOOD_FLAG)) || 0;
  if (contribution > 0) {
    return `<div class="daemonblood-panel">
      <div class="daemonblood-status">Жертва принесена: <b>${contribution}</b> аблативных Ран от Daemonblood.</div>
    </div>`;
  }
  return `<div class="daemonblood-panel">
    <div class="daemonblood-hint">Полудействие: пролить 1-3×PR крови ради стольких же аблативных Ран.</div>
    <button type="button" class="daemonblood-btn" data-item-id="${item.id}">
      ${rollIcon("blood","#8b1a1a")}Кровавая Жертва
    </button>
  </div>`;
}

// module/sheets/tabs/conditions.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Состояния и Усталость: кнопки +1/−1, отдых, сон и диалог добавления
//  состояний. Функции принимают актора, а не лист.
// ════════════════════════════════════════════════════════════════════════════

import { CONDITIONS_DEF } from "../sheet-helpers.mjs";
import { HOMEWORLD_BY_KEY } from "../../constants/homeworlds.mjs";
import { rollIcon } from "../../constants/roll-icons.mjs";
import { esc, on } from "../../helpers/utils.mjs";

function fatigueThreshold(actor) {
  const system = actor.system || {};
  const tb = system.characteristics?.t?.bonus ?? 0;
  const wb = system.characteristics?.wp?.bonus ?? 0;
  return { tb, wb, threshold: tb + wb };
}

function actorHomeworldKey(actor) {
  return actor?.items?.find(i => i.type === "homeworld")?.system?.key || "";
}

export function fatiguePenalty(actor, charKey) {
  const fatigueExempt = ["t", "inf", "cog", "pf"];
  // Добывающий мир, «Потом и кровью»: штрафы начинаются лишь после T.b Усталости.
  const hw = HOMEWORLD_BY_KEY[actorHomeworldKey(actor)];
  const grace = hw?.fatigueGrace === "tBonus" ? (actor.system.characteristics?.t?.bonus ?? 0) : 0;
  if ((actor.system.fatigue?.value ?? 0) < 1 + grace) return 0;
  if (fatigueExempt.includes((charKey ?? "").toLowerCase())) return 0;
  return -10;
}

export async function addFatigue(actor, amount = 1) {
  const system = actor.system;
  const { tb, threshold } = fatigueThreshold(actor);
  const current = system.fatigue?.value ?? 0;
  const newVal = current + amount;

  const updates = {
    "system.fatigue.value": newVal,
    "system.fatigue.max": threshold
  };

  if (threshold > 0 && newVal >= threshold) {
    const unconsciousMinutes = Math.max(1, 10 - tb);
    updates["system.conditions.unconscious"] = true;

    await actor.update(updates);

    const rollMode = game.settings.get("core", "rollMode");
    await ChatMessage.create(ChatMessage.applyRollMode({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<div class="wh-roll-result">
        <div class="roll-header">${rollIcon("warn","#ff6b6b")}${esc(actor.name)} — Потеря сознания!</div>
        <div class="roll-threshold">
          Усталость: <b>${newVal}</b> ≥ порог T.b + W.b (<b>${threshold}</b>) — превышен.
        </div>
        <div class="roll-outcome">
          <span class="roll-failure">
            Персонаж без сознания <b>${unconsciousMinutes}</b> мин.
            (10 − ${tb} = ${unconsciousMinutes}, мин. 1)
          </span>
        </div>
        <div class="roll-threshold" style="font-size:0.85em;">
          После прихода в себя — снимается 1 Усталость автоматически.
        </div>
      </div>`
    }, rollMode));

    ui.notifications.warn(`${actor.name} потерял сознание на ${unconsciousMinutes} минут!`);
  } else {
    await actor.update(updates);
    if (newVal >= 1 && current < 1) {
      ui.notifications.info(`${actor.name}: Усталость 1+ — штраф −10 на все тесты (кроме T, Inf, Cog).`);
    }
  }
}

export async function removeFatigue(actor, amount = 1) {
  const system = actor.system;
  const current = system.fatigue?.value ?? 0;
  const { threshold } = fatigueThreshold(actor);
  const newVal = Math.max(0, current - amount);

  const updates = {
    "system.fatigue.value": newVal,
    "system.fatigue.max": threshold
  };

  if (system.conditions?.unconscious && newVal < threshold) {
    updates["system.conditions.unconscious"] = false;
  }

  await actor.update(updates);
}

export async function fatiguePeriodRest(actor) {
  const current = actor.system.fatigue?.value ?? 0;
  if (current <= 0) {
    ui.notifications.info(`${actor.name}: Усталость и так 0.`);
    return;
  }
  await removeFatigue(actor, 1);

  const rollMode = game.settings.get("core", "rollMode");
  await ChatMessage.create(ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="wh-roll-result">
      <div class="roll-header">${rollIcon("spark","#4dffa6")}${esc(actor.name)} — Час отдыха</div>
      <div class="roll-outcome">
        <span class="roll-success">Снята 1 Усталость. Осталось: <b>${Math.max(0, current - 1)}</b></span>
      </div>
    </div>`
  }, rollMode));
}

export async function fatigueSleep(actor) {
  const current = actor.system.fatigue?.value ?? 0;
  const { threshold } = fatigueThreshold(actor);

  await actor.update({
    "system.fatigue.value": 0,
    "system.fatigue.max": threshold,
    "system.conditions.unconscious": false
  });

  const rollMode = game.settings.get("core", "rollMode");
  await ChatMessage.create(ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="wh-roll-result">
      <div class="roll-header">${rollIcon("spark","#4dffa6")}${esc(actor.name)} — Полноценный сон</div>
      <div class="roll-outcome">
        <span class="roll-success">Вся Усталость снята (было: <b>${current}</b>).</span>
      </div>
    </div>`
  }, rollMode));
}

/** Крестик в строке состояния: снять его, а со счётчиком — обнулить и счётчик. */
export async function removeCondition(actor, key) {
  const def     = CONDITIONS_DEF[key];
  const updates = { [`system.conditions.${key}`]: false };
  if (def?.hasLevel && def.levelField) {
    updates[`system.conditions.${def.levelField}`] = 0;
  }
  await actor.update(updates);
}

/** Поле уровня: раунды оглушения, стадии кровотечения и прочие счётчики. */
export async function setConditionLevel(actor, key, value) {
  const def = CONDITIONS_DEF[key];
  const val = parseInt(value) || 0;
  if (!def?.hasLevel || !def.levelField) return;
  await actor.update({ [`system.conditions.${def.levelField}`]: val });
}

export function showAddConditionDialog(actor) {
  const conditions = actor.system.conditions || {};
  const inactive = Object.entries(CONDITIONS_DEF)
    .filter(([key]) => !conditions[key])
    .map(([key, def]) =>
      `<label class="add-cond-label" style="--cond-color:${def.color || "#4dffa6"};">
        <input type="checkbox" class="add-cond-cb" data-condition="${key}"/>
        <span class="add-cond-icon">${def.svg || def.icon}</span>
        <span class="add-cond-name">${def.label}</span>
      </label>`
    ).join("");

  if (!inactive) {
    ui.notifications.info("Все состояния уже активны!");
    return;
  }

  // Не <form>: содержимое DialogV2 уже внутри его формы, вложенная недопустима.
  return foundry.applications.api.DialogV2.wait({
    window: { title: "Добавить состояние" },
    classes: ["wh-add-condition-dialog", "warhammer-dbc", "wh-holo"],
    position: { width: 360 },
    content: `
      <div class="wh-add-condition-form">
        <div class="add-cond-list">${inactive}</div>
      </div>`,
    rejectClose: false,
    buttons: [
      {
        action: "add", label: "Добавить", icon: "fas fa-plus", default: true,
        callback: async (event, button) => {
          const updates = {};
          for (const cb of button.form.querySelectorAll(".add-cond-cb:checked"))
            updates[`system.conditions.${cb.dataset.condition}`] = true;
          if (Object.keys(updates).length) await actor.update(updates);
        }
      },
      { action: "cancel", label: "Отмена" }
    ]
  });
}

export function activateConditionsListeners(root, actor) {
  on(root, ".conditions-add-btn", "click", ev => {
    ev.preventDefault();
    showAddConditionDialog(actor);
  });

  on(root, ".condition-remove-btn", "click", async ev => {
    ev.preventDefault();
    ev.stopPropagation();
    await removeCondition(actor, ev.currentTarget.dataset.condition);
  });

  on(root, ".condition-level-input", "change", async ev => {
    ev.stopPropagation();
    await setConditionLevel(actor, ev.currentTarget.dataset.condition, ev.currentTarget.value);
  });

  on(root, ".fatigue-add-btn", "click", async ev => {
    ev.preventDefault();
    await addFatigue(actor, 1);
  });
  on(root, ".fatigue-remove-btn", "click", async ev => {
    ev.preventDefault();
    await removeFatigue(actor, 1);
  });
  on(root, ".fatigue-rest-btn", "click", async ev => {
    ev.preventDefault();
    await fatiguePeriodRest(actor);
  });
  on(root, ".fatigue-sleep-btn", "click", async ev => {
    ev.preventDefault();
    await fatigueSleep(actor);
  });
}

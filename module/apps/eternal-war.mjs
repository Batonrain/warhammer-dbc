// module/apps/eternal-war.mjs
//
// UI/действие Таланта «The Eternal War / Вечная Война» (wdbc-173l) — см.
// module/rules/eternal-war.mjs про арифметику и почему условие «сражается
// именно против Кровожада/Хранителя Секретов» не проверяется автоматически.

import { isEternalWarItem, eternalWarGrant, eternalWarClear, ETERNAL_WAR_FLAG,
         eternalWarShrinkToFit } from "../rules/eternal-war.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";

export { isEternalWarItem };

const FLAG = "warhammer-dbc";

/**
 * Ресинк ПОСЛЕ того, как общий ablative пул уменьшился по другой причине
 * (поглощение урона) — вызывать из хука updateActor.
 */
export async function reconcileEternalWarToFit(actor) {
  const prev = Number(actor.getFlag(FLAG, ETERNAL_WAR_FLAG)) || 0;
  if (prev <= 0) return;
  const result = eternalWarShrinkToFit(actor.system, prev);
  if (!result) return;
  await actor.update({
    "system.wounds.ablativeMax": result.ablativeMax,
    [`flags.${FLAG}.${ETERNAL_WAR_FLAG}`]: result.contribution
  });
}

/** Нажатие кнопки «Дуэль началась». */
export async function useEternalWarStart(actor, item) {
  if (!isEternalWarItem(item) || !actor) return;
  const tBonus = Number(actor.system?.characteristics?.t?.bonus) || 0;
  const prevContribution = Number(actor.getFlag(FLAG, ETERNAL_WAR_FLAG)) || 0;
  const result = eternalWarGrant(actor.system, prevContribution, tBonus);
  await actor.update({
    "system.wounds.ablative": result.ablative,
    "system.wounds.ablativeMax": result.ablativeMax,
    [`flags.${FLAG}.${ETERNAL_WAR_FLAG}`]: result.contribution
  });
  await ChatMessage.create(ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="wh-roll-result">
      <div class="roll-header">${rollIcon("sword","#c9b37a")}The Eternal War — дуэль началась</div>
      <div class="roll-threshold">3×T.b аблативных Ран → <b>${result.contribution}</b></div>
      <div class="roll-threshold" style="opacity:.8;">Не смоделировано: подъём Unnatural Characteristic, T.b невосстанавливаемых Очков Судьбы, изгнание души смертельным ударом — отыгрывать вручную.</div>
    </div>`,
    sound: null
  }, game.settings.get("core", "rollMode")));
}

/** Нажатие кнопки «Битва окончена». */
export async function useEternalWarEnd(actor, item) {
  if (!isEternalWarItem(item) || !actor) return;
  const prevContribution = Number(actor.getFlag(FLAG, ETERNAL_WAR_FLAG)) || 0;
  const result = eternalWarClear(actor.system, prevContribution);
  if (!result) return;
  await actor.update({
    "system.wounds.ablative": result.ablative,
    "system.wounds.ablativeMax": result.ablativeMax,
    [`flags.${FLAG}.${ETERNAL_WAR_FLAG}`]: result.contribution
  });
}

/** Кнопки на листе предмета — пусто, если это не The Eternal War или нет актора. */
export function eternalWarButtonHtml(item, actor) {
  if (!isEternalWarItem(item) || !actor) return "";
  const contribution = Number(actor.getFlag(FLAG, ETERNAL_WAR_FLAG)) || 0;
  return `<div class="eternal-war-panel">
    <div class="eternal-war-hint">Сражаясь именно против Кровожада или Хранителя Секретов:</div>
    <button type="button" class="eternal-war-start-btn" data-item-id="${item.id}">
      ${rollIcon("sword","#c9b37a")}Дуэль началась (+3×T.b аблатива)
    </button>
    ${contribution > 0 ? `<button type="button" class="eternal-war-end-btn" data-item-id="${item.id}">
      ${rollIcon("skull","#5a4a30")}Битва окончена (сброс)
    </button>` : ""}
  </div>`;
}

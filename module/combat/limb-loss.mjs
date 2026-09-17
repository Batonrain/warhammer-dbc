// module/combat/limb-loss.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Foundry-обвязка над module/rules/limb-loss.mjs (стр. 30-31, wdbc-1rno.6):
//  планирование/снятие/розыгрыш отложенной проверки Гангрены обрубка.
//  Источники наложения lostX сами решают, звать ли scheduleLimbLossGangreneFields
//  — combat/crit-effect-parser.mjs зовёт, будущая Мутация Loss of Limb
//  (wdbc-1rno.6.1) — намеренно нет (её обрубок книга описывает уже
//  закрытым, без риска нагноения).
// ════════════════════════════════════════════════════════════════════════════

import {
  limbLossGangreneField, limbLossGangreneCheckAt, dueLimbLossGangreneKeys
} from "../rules/limb-loss.mjs";
import { conditionApplyFields } from "../sheets/tabs/conditions.mjs";
import { CONDITIONS_DEF } from "../constants/conditions.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { esc } from "../helpers/utils.mjs";

/** Патч «запланировать проверку Гангрены обрубка через T.b дней от сейчас». */
export function scheduleLimbLossGangreneFields(actor, key) {
  const field = limbLossGangreneField(key);
  if (!field || !actor) return {};
  const tb = actor.system?.characteristics?.t?.bonus ?? 0;
  return { [`system.conditions.${field}`]: limbLossGangreneCheckAt(game.time.worldTime, tb) };
}

/** Патч «обрубок обработан вовремя» — таймер снят, Гангрена не разыгрывается. */
export function clearLimbLossGangreneFields(key) {
  const field = limbLossGangreneField(key);
  return field ? { [`system.conditions.${field}`]: 0 } : {};
}

/**
 * Просроченные таймеры — розыгрыш 1d10 (книжные «80%, 1-8 на 1d10» —
 * Гангрена), снятие таймера и карточка в чат. Тот же GM-гейт, что
 * apps/wrapped-in-chaos.mjs::sweepSweetMistExpiry — чистит только основной
 * активный ГМ. Зовётся из ТОГО ЖЕ Hooks.on("updateWorldTime", …), что уже
 * двигает виджет Календаря (warhammer-dbc.mjs), по прямому указанию
 * пользователя — не отдельный новый хук.
 */
export async function sweepLimbLossGangrene(worldTime) {
  if (!game.users?.activeGM || game.user?.id !== game.users.activeGM.id) return;
  for (const actor of game.actors ?? []) {
    const due = dueLimbLossGangreneKeys(actor.system?.conditions, worldTime);
    for (const key of due) {
      const field = limbLossGangreneField(key);
      const roll = await new Roll("1d10").evaluate();
      const gangrene = roll.total <= 8;
      const updates = { [`system.conditions.${field}`]: 0 };
      if (gangrene) Object.assign(updates, conditionApplyFields("gangrene", null, actor));
      await actor.update(updates);

      const def = CONDITIONS_DEF[key];
      await ChatMessage.create(ChatMessage.applyRollMode({
        speaker: ChatMessage.getSpeaker({ actor }),
        content: `<div class="wh-roll-result">
          <div class="roll-header">${rollIcon("skull", gangrene ? "#ff6b6b" : "#9fd08a")}${esc(actor.name)} — Обрубок (${esc(def?.label || key)})</div>
          <div class="roll-threshold">Обрубок не был обработан вовремя — проверка Гангрены (80%, 1-8 на 1d10): бросок <b>${roll.total}</b></div>
          <div class="roll-outcome">${gangrene
            ? `<span class="roll-failure">Обрубок загноился — наложена Гангрена.</span>`
            : `<span class="roll-success">Пронесло — заживление обошлось без осложнений.</span>`}</div>
        </div>`,
        rolls: [roll],
        sound: CONFIG.sounds.dice
      }, game.settings.get("core", "rollMode")));
    }
  }
}

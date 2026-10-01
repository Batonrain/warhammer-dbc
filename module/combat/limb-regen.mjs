// module/combat/limb-regen.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Регенерация потерянных частей тела у Йигори (New Men, wdbc-yffxj). Сроки и
//  арифметика — rules/limb-loss.mjs (LIMB_REGEN_DAYS, regenStartFields,
//  dueLimbRegenSides); здесь Foundry-обвязка:
//   • regenOnPreUpdate — в preUpdateActor (warhammer-dbc.mjs): любая запись
//     потери части тела носителем возможности newMen.regeneration получает
//     таймер отрастания тем же update — единая точка вместо правки каждого
//     писателя (крит, ампутация, ручная правка);
//   • limbRegenClock — обработчик часов Состояний (combat/condition-clock.mjs):
//     срок вышел — часть тела возвращается, карточка в чат.
//  Бионика и потеря мутацией таймера не получают: бионика возвращает «потеряна:
//  нет» и гасит таймер, у мутации своя пометка (rules/limb-loss.mjs).
// ════════════════════════════════════════════════════════════════════════════

import { hasRuleFlag } from "../rules/flags.mjs";
import { NEW_MEN } from "../rules/new-men.mjs";
import { regenStartFields, dueLimbRegenSides, lostSideFields, lostSideKey, BODY_SIDE_SHORT } from "../rules/limb-loss.mjs";
import { CONDITIONS_DEF } from "../constants/conditions.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { esc } from "../helpers/utils.mjs";

/** preUpdateActor: дописать таймер отрастания к правке, которая теряет часть тела. */
export function regenOnPreUpdate(actor, changes) {
  if (!actor || !changes || !hasRuleFlag(actor, NEW_MEN.regeneration)) return;
  const flat = foundry.utils.flattenObject(changes);
  const patch = regenStartFields(actor.system, flat, game.time?.worldTime ?? 0);
  for (const [path, value] of Object.entries(patch)) foundry.utils.setProperty(changes, path, value);
}

/** Обработчик часов Состояний: отросшие к концу отрезка части тела возвращаются. */
export async function limbRegenClock(actor, { to }) {
  if (!hasRuleFlag(actor, NEW_MEN.regeneration)) return;
  const due = dueLimbRegenSides(actor.system, to);
  if (!due.length) return;
  const patch = {};
  const lines = [];
  for (const { key, side } of due) {
    Object.assign(patch, lostSideFields(key, side, { lost: false }));
    patch[`system.lostLimbs.${lostSideKey(key, side)}.regenAt`] = 0;
    lines.push(`${esc(CONDITIONS_DEF[key]?.label || key)} (${BODY_SIDE_SHORT[side]}) — <span class="roll-success">отросла</span>.`);
  }
  await actor.update(patch);
  await ChatMessage.create(ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="wh-roll-result">
      <div class="roll-header">${rollIcon("heart", "#9fd08a")}${esc(actor.name)} — Регенерация (Новые Люди)</div>
      <div class="roll-threshold">${lines.join("<br/>")}</div>
    </div>`
  }, game.settings.get("core", "rollMode")));
}

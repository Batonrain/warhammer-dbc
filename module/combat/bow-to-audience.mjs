// module/combat/bow-to-audience.mjs
// ════════════════════════════════════════════════════════════════════════
//  Bow to the Audience / Поклон Публике (wdbc-1rno,
//  harlequin.solitaire.bowToTheAudience): «За 3 ОД персонаж проходит
//  Awareness(P)−20 против до P.b видимых противников, умножает успехи на
//  три и получает на один Ход бонус на все физические действия против них,
//  накладывая равный штраф на их физические Избегания».
//
//  Цели — game.user.targets (тот же приём, что Bone Song, wdbc-sk8s), до
//  P.b штук. Успех теста — deg×3 (module/rules/roll-outcome.mjs::testOutcome,
//  «умножает успехи» = степень успеха). Метка живёт на АТАКУЮЩЕМ (актор,
//  прошедший тест) как flags.warhammer-dbc.bowToAudienceMark
//  {targetIds, bonus} — не на целях: «на один Ход» здесь читается как
//  «до начала следующего Хода атакующего» (тот же приём, что Dread Wail/
//  dreadWailWeaponBuff, hooks.mjs::updateCombat clearBowToAudienceMark).
//  module/sheets/attack-dialog.mjs читает ЭТОТ флаг на АТАКУЮЩЕМ и сверяет
//  attackCtx.targetActor.id со списком — бонус атакующему и штраф Избеганию
//  цели применяются ТОЛЬКО когда бьёт именно отметивший, не любой союзник
//  (точнее книжного текста, чем плоская метка на цели).
//
//  Провал теста — ОД потрачены, метка не ставится (действие израсходовано
//  впустую, как у прочих активных находок этой сессии).
// ════════════════════════════════════════════════════════════════════════

import { itemHasName } from "../rules/predicates.mjs";
import { hasAbility } from "../rules/ability-by-key.mjs";
import { hasActionEconomy, spendActionPoints } from "./action-economy.mjs";
import { testOutcome } from "../rules/roll-outcome.mjs";
import { SKILLS_DEF } from "../constants/skills.mjs";
import { esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { collectTestMods } from "../rules/roll-mods.mjs";

const MARK_FLAG = "bowToAudienceMark";

export function hasBowToAudience(actor) {
  return hasAbility(actor, "ability.bowToTheAudience", "Bow to the Audience", "talent");
}

/** Итог Бдительности (с учётом Тренировки) — умолчание на P, если записи Навыка на акторе нет вовсе. */
function awarenessTotal(actor) {
  const sk = actor.system.skills?.awareness;
  if (sk?.total != null) return sk.total;
  const charKey = SKILLS_DEF.awareness?.char;
  return actor.system.characteristics?.[charKey]?.total ?? 0;
}

/** {disabled, title} для кнопки — гейт виден ДО клика. */
export function bowToAudienceGate(actor) {
  const perBonus = Number(actor?.system?.characteristics?.per?.bonus) || 0;
  const targetsCount = game.user?.targets?.size || 0;
  const apOk = (Number(actor?.system?.actionPoints?.value) || 0) >= 3;
  if (perBonus <= 0) return { disabled: true, title: "P.b = 0 — нет доступных целей" };
  if (!targetsCount) return { disabled: true, title: "Выберите хотя бы одну цель (Target)" };
  if (!apOk) return { disabled: true, title: `Не хватает ОД: нужно 3, есть ${Number(actor?.system?.actionPoints?.value) || 0}` };
  return { disabled: false, title: `Awareness(P)−20 против до ${perBonus} целей, 3 ОД` };
}

/** Клик по кнопке: тратит 3 ОД, катает Awareness−20, при успехе метит до P.b целей. */
export async function triggerBowToAudience(actor) {
  if (!hasActionEconomy(actor) || !hasBowToAudience(actor)) return null;
  const perBonus = Math.max(0, Number(actor.system?.characteristics?.per?.bonus) || 0);
  const targets = [...(game.user?.targets ?? [])].map(t => t.actor).filter(Boolean).slice(0, perBonus);
  if (!targets.length) { ui.notifications?.warn("⚠️ Нет выбранных целей."); return null; }
  if (!await spendActionPoints(actor, 3)) { ui.notifications?.warn("⚠️ Не хватает ОД (нужно 3)."); return null; }

  // Общий сбор модификаторов (wdbc-ct65.3): тест Внимательности шёл мимо
  // реестра правил.
  const ruleMods = collectTestMods(actor, { kind: "skill", skill: "awareness", char: "per" });
  const threshold = awarenessTotal(actor) - 20 + ruleMods.total;
  const roll = await new Roll("1d100").evaluate();
  const { success, deg } = testOutcome(roll.total, threshold);
  const bonus = success ? deg * 3 : 0;

  if (success) {
    await actor.setFlag("warhammer-dbc", MARK_FLAG, { targetIds: targets.map(t => t.id), bonus });
  }

  const targetNames = targets.map(t => esc(t.name)).join(", ");
  await ChatMessage.create(ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="wh-roll-result">
      <div class="roll-header">${rollIcon("spark", "#c98bff")}${esc(actor.name)} — Поклон Публике</div>
      <div class="roll-threshold">Awareness(P)−20${ruleMods.parts.map(p => ` ${p}`).join("")} = <b>${threshold}</b>, бросок <b>${roll.total}</b> — ${success ? `успех, степень ${deg}` : "провал"}.</div>
      ${success
        ? `<div class="roll-threshold">Цели (${esc(targetNames)}) отмечены: <b>+${bonus}</b> атакующему / <b>−${bonus}</b> их физическим Избеганиям до начала следующего Хода атакующего.</div>`
        : `<div class="roll-threshold">Действие израсходовано впустую — метка не наложена.</div>`}
    </div>`
  }, game.settings.get("core", "rollMode")));

  return { success, deg, bonus, targets };
}

/** Снимает метку — звать в начале Хода атакующего (hooks.mjs::updateCombat, тот же такт, что clearDreadWailWeaponBuff). */
export async function clearBowToAudienceMark(actor) {
  if (actor?.getFlag?.("warhammer-dbc", MARK_FLAG)) {
    await actor.unsetFlag("warhammer-dbc", MARK_FLAG);
  }
}

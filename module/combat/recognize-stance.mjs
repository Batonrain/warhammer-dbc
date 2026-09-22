// module/combat/recognize-stance.mjs
// ════════════════════════════════════════════════════════════════════════
//  РАСПОЗНАТЬ СТОЙКУ (стр. 15, wdbc-x1nz.2.66.11) — общее правило Стоек:
//  «Раз в Ход персонаж может пройти тест Awareness(WS)+20, чтобы понять
//  чужие стойки в его поле зрения. Если Предел этого теста 75+, это
//  автоуспех.»
//
//  Книжное «в его поле зрения» — не автоматизировано (нет проверки линии
//  видимости), тот же честный предел, что у остальных «выцелите цель»
//  механик этого файла: цель берётся из game.user.targets, как везде.
//
//  «Awareness(WS)» — Навык Бдительность (обычно keyed на Per, module/
//  constants/skills.mjs) здесь заменяет свою характеристику на WS. Общей
//  инфраструктуры «тот же Навык, другая характеристика» в системе нет —
//  переносится ТРЕНИРОВОЧНАЯ надбавка (skillTotal − raw Per), а не весь
//  тест целиком: нетренированный персонаж получает голый WS+20, тренированный
//  Awareness — тот же бонус тренировки, что и на обычном тесте, просто
//  поверх WS вместо Per.
// ════════════════════════════════════════════════════════════════════════

import { esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { postTestCard, outcomeHtml, rollStatLine } from "../helpers/test-card.mjs";
import { testOutcome } from "../rules/roll-outcome.mjs";
import { collectTestMods } from "../rules/roll-mods.mjs";
import { skillTotal } from "./movement-actions.mjs";
import { isRoundCapabilityAvailable, markRoundCapabilityUsed } from "../apps/game-session.mjs";
import { MELEE_STANCES } from "../constants/combat.mjs";

export const RECOGNIZE_STANCE_CAPABILITY = "recognizeStance";

/** Awareness(WS)+0 — тренировочная надбавка Бдительности, перенесённая с Per на WS. */
export function awarenessOnWs(actor) {
  const ws  = Number(actor?.system?.characteristics?.ws?.total) || 0;
  const per = Number(actor?.system?.characteristics?.per?.total) || 0;
  const trainingDelta = skillTotal(actor, "awareness") - per;
  return ws + trainingDelta;
}

export async function rollRecognizeStance(actor) {
  if (!actor) return;
  if (!isRoundCapabilityAvailable(actor, RECOGNIZE_STANCE_CAPABILITY)) {
    return ui.notifications.warn("⚠️ Распознать Стойку — уже использовано в этом Раунде.");
  }
  const target = [...(game.user?.targets ?? [])][0]?.actor ?? null;
  if (!target) return ui.notifications.warn("⚠️ Выберите токен цели на сцене!");

  const base = awarenessOnWs(actor);
  const mods = collectTestMods(actor, { kind: "skill", char: "ws", skill: "awareness" });
  const threshold = base + 20 + mods.total;
  const autoSuccess = threshold >= 75;
  const roll = await new Roll("1d100").evaluate();
  const { success, deg } = testOutcome(roll.total, threshold, { autoSuccess });

  await markRoundCapabilityUsed(actor, RECOGNIZE_STANCE_CAPABILITY);

  const targetStance = target.system?.meleeStance || "standard";
  const stanceLabel = MELEE_STANCES[targetStance]?.label ?? targetStance;

  await postTestCard(actor, {
    icon: rollIcon("eye", "#8fd0ff"),
    title: `Распознать Стойку: ${esc(target.name)}`,
    threshold: rollStatLine({
      label: "Awareness(WS)", base,
      parts: [`+20`, ...mods.parts],
      threshold, rv: roll.total
    }),
    outcome: autoSuccess && success
      ? outcomeHtml(true, `Автоуспех — Предел ${threshold} (75+)`)
      : outcomeHtml(success, success ? `Успех — ${deg} степеней` : `Провал — ${deg} степеней`),
    sections: [
      success
        ? `<div class="roll-threshold">Стойка ${esc(target.name)}: <b>${esc(stanceLabel)}</b></div>`
        : ""
    ]
  }, { rolls: [roll] });
}

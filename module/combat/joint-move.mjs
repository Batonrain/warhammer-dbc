// module/combat/joint-move.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Совместное Перемещение (стр. 27): несколько персонажей поднимают/толкают/
//  переворачивают тяжёлый предмет вместе — суммируются их ВЕСОВЫЕ ЛИМИТЫ
//  (Толкание/Подъём каждого, не суммы S.b+T.b), а не характеристики. Отдельно
//  от общего механизма Ассистентов (rules/assists.mjs, стр. 25: +10 Порог/+1°
//  за помощника, до DEFAULT_ASSIST_MAX) книга здесь СОЗНАТЕЛЬНО режет бонус:
//  «этот тест не получает бонусов от ассистентов, пока суммарный вес... не
//  превысит вес предмета, и только тогда «лишние» ассистенты будут давать
//  бонусы» — т.е. помощники, чья грузоподъёмность физически НУЖНА, чтобы
//  вообще сдвинуть предмет, сами по себе бонуса не дают, только те, что сверх
//  необходимого. excessAssistCount ниже считает именно это число, а не общее
//  количество участников; общий предел DEFAULT_ASSIST_MAX всё равно
//  применяется поверх (книга это не отменяет, только сужает, КОГО считать
//  помощником вообще).
//
//  Захват цели → пропуск Ходов до Хода последнего участника → сам подъём/
//  толкание (стр. 27) — это оркестровка боевого раунда, не число: не
//  автоматизируется здесь, ведётся вручную (Захват уже есть, combat/
//  grapple.mjs, очерёдность Ходов — трекер Foundry).
// ════════════════════════════════════════════════════════════════════════════

import { spendActionPoints } from "./action-economy.mjs";
import { collectTestMods } from "../rules/roll-mods.mjs";
import { testOutcome } from "../rules/roll-outcome.mjs";
import { assistThresholdBonus, assistDegrees, DEFAULT_ASSIST_MAX } from "../rules/assists.mjs";
import { forceMoveDistance } from "./force-move.mjs";
import { esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { postTestCard, rollStatLine, outcomeHtml } from "../helpers/test-card.mjs";

/** Собственный весовой лимит участника для этого способа — Толкание или Подъём/Переворот. */
export function jointMoveCapacity(actor, mode) {
  const enc = actor?.system?.encumbrance || {};
  return Number(mode === "push" ? enc.push : enc.lift) || 0;
}

/**
 * Сколько ассистентов (после ведущего) сверх необходимого для превышения
 * веса предмета — идут по порядку списка, каждый либо «нужен» (его лимит
 * досчитывает сумму до веса), либо «лишний» (сумма уже покрывала вес ДО его
 * учёта). Порядок задаёт вызывающий (естественно — от сильнейшего к
 * слабейшему, чтобы «лишними» оказались самые слабые, но книга порядок не
 * оговаривает — решение зафиксировано здесь, не подстроено под число).
 */
export function excessAssistCount(leadCapacity, assistCapacities, weight) {
  let cum = Number(leadCapacity) || 0;
  let excess = 0;
  for (const cap of assistCapacities) {
    if (cum >= weight) excess++;
    cum += Number(cap) || 0;
  }
  return excess;
}

/** Сводка группы: суммарная грузоподъёмность, хватает ли на вес, и число реально засчитываемых помощников (капнуто DEFAULT_ASSIST_MAX). */
export function jointMoveSummary(actors, mode, weight) {
  const caps = actors.map(a => jointMoveCapacity(a, mode));
  const [leadCapacity = 0, ...assistCapacities] = caps;
  const total = caps.reduce((sum, c) => sum + c, 0);
  const rawExcess = excessAssistCount(leadCapacity, assistCapacities, weight);
  return { total, sufficient: total >= weight, assistCount: Math.min(rawExcess, DEFAULT_ASSIST_MAX) };
}

/**
 * Тест ведущего (Athletics(S)+0) с бонусом только от «лишних» помощников
 * (jointMoveSummary выше) — Захват/очерёдность Ходов книга требует пройти
 * ДО этого клика, здесь только сам бросок и его исход.
 */
export async function useJointMove(lead, assistants, { mode = "lift", weight = 0 } = {}) {
  if (!lead) return;
  const summary = jointMoveSummary([lead, ...(assistants || [])], mode, weight);
  if (!summary.sufficient) {
    return ui.notifications.warn(
      `⚠️ Суммарная грузоподъёмность группы (${summary.total} кг) не достигает веса предмета (${weight} кг) — сдвинуть нельзя.`);
  }
  if (!await spendActionPoints(lead, 2, { physical: true })) {
    return ui.notifications.warn("⚠️ Не хватает ОД на Полное действие (обе руки) у ведущего.");
  }

  const athletics = lead.system?.skills?.athletics?.total ?? -20;
  const ruleMods = collectTestMods(lead, { kind: "skill", skill: "athletics", char: "s" });
  const assistBonus = assistThresholdBonus(summary.assistCount);
  const threshold = athletics + ruleMods.total + assistBonus;

  const roll = await new Roll("1d100").evaluate();
  const rv = roll.total;
  const outcome = testOutcome(rv, threshold);
  const successes = assistDegrees(outcome.success ? outcome.deg : 0, summary.assistCount, outcome.success);
  const spd = lead.system?.movement?.spd ?? 0;
  const distance = outcome.success ? forceMoveDistance(mode, successes, spd) : 0;

  const parts = [...ruleMods.parts];
  if (assistBonus) parts.push(`Лишние помощники (${summary.assistCount}) +${assistBonus}`);
  const dice = await roll.render();
  const modeLabel = mode === "push" ? "Толкание" : "Подъём/Переворот";
  await postTestCard(lead, {
    icon: rollIcon("run", "#b0a080"),
    title: `${esc(lead.name)} + ${(assistants || []).length} — Совместное Перемещение (${modeLabel})`,
    threshold: rollStatLine({ label: "Athletics(S)", base: athletics, parts, threshold, rv }),
    outcome: outcome.success
      ? outcomeHtml(true, `Успех — сдвинуто на ${distance}м (${successes} Усп.)`)
      : outcomeHtml(false, "Провал — не удалось сдвинуть"),
    sections: [
      `<div class="roll-threshold" style="font-size:.85em;opacity:.8;">Грузоподъёмность группы: ${summary.total} кг из ${weight} кг нужных. Реально засчитанных помощников (сверх необходимого): ${summary.assistCount}.</div>`,
      `<details class="roll-dice-details"><summary>${rollIcon("chart", "#8fd0ff")}Показать кубы</summary>${dice}</details>`
    ]
  }, { rolls: [roll] });
}

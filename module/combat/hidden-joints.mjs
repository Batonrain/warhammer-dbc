// module/combat/hidden-joints.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Скрытые Сочленения (core.json, «Броня», раздел «Скрытые Сочленения»,
//  wdbc-x1nz.4): «Одежда или мягкая броня, носимая поверх жесткой брони,
//  визуально закрывает сочленения, что усложняет атаки по ним и увеличивает
//  штраф на атаки в сочленения на 10. Атакующий может пройти тест на Common
//  Lore (War)(I)+0, чтобы игнорировать этот штраф, определяя сочленения «по
//  памяти»...»
//
//  Приближённая автоматизация (решение владельца, wdbc-x1nz.4): система не
//  знает, что из брони надето СВЕРХУ — только что на одной локации цели
//  одновременно присутствуют Мягкая (soft) и Жёсткая (hard) броня
//  (hasHiddenJoints, combat/armor-properties.mjs). Сам штраф +10 — отдельная
//  строка modParts в sheets/attack-dialog.mjs («Скрытые Сочленения цели»,
//  только для f.aimVal === "joint").
//
//  Снятие штрафа — постфактум, кнопкой на уже брошенной карточке атаки, а не
//  галочкой до броска: тот же приём, что Горжет (combat/attack.mjs — rating
//  проверка у ЦЕЛИ) и сдвиг места попадания (±A.b) — переигровка ТОЙ ЖЕ
//  карточки тем же forcedRoll, hooks.mjs::wh-hidden-joints-btn. Разница с
//  Горжетом: там кнопку жмёт ЗАЩИЩАЮЩИЙСЯ и бросок фиксированный (1d10 против
//  rating), здесь — АТАКУЮЩИЙ и полноценный тест Навыка (Common Lore (War)+0,
//  со степенями успеха/провала, как в combat/tank-hunter.mjs), поэтому решение
//  о порог+10 принимает вызывающая сторона (hooks.mjs), передавая его прямо в
//  четвёртый параметр _executeAttackRoll — эта функция сама по себе ничего не
//  знает об исходной атаке.
// ════════════════════════════════════════════════════════════════════════════

import { findGroupEntry } from "../constants/skill-specializations.mjs";
import { collectTestMods } from "../rules/roll-mods.mjs";
import { testOutcome } from "../rules/roll-outcome.mjs";
import { postTestCard, rollStatLine } from "../helpers/test-card.mjs";
import { esc, _degWord } from "../helpers/utils.mjs";

/** Штраф «Скрытые Сочленения» (sheets/attack-dialog.mjs), который компенсирует успешный тест. */
export const HIDDEN_JOINTS_PENALTY = -10;

/** Порог Common Lore (War)+0: запись специализации, иначе Int−20 как нетренированный. */
function loreThreshold(actor) {
  const entry = findGroupEntry(actor, "commonLore", "War");
  const int = Number(actor?.system?.characteristics?.int?.total) || 20;
  return Number.isFinite(entry?.total) ? entry.total : int - 20;
}

/**
 * Клик «Определить сочленения по памяти» на карточке атаки (атакующий, не
 * защищающийся). Бросает Common Lore (War)+0 и постит отдельную карточку
 * теста — переигровку ТОЙ ЖЕ карточки атаки с учётом исхода делает вызывающая
 * сторона (hooks.mjs::wh-hidden-joints-btn), этой функции не нужны ни
 * оружие, ни сама атака.
 *
 * @returns {{success: boolean, roll: number, threshold: number, deg: number}}
 */
export async function resolveHiddenJointsClick(actor) {
  const base = loreThreshold(actor);
  const ruleMods = collectTestMods(actor, { kind: "skill", skill: "commonLore", char: "int" });
  const threshold = base + ruleMods.total;
  const roll = await new Roll("1d100").evaluate();
  const rv = roll.total;
  const { success, deg } = testOutcome(rv, threshold);
  await postTestCard(actor, {
    icon: "🦾", title: `Скрытые Сочленения — ${esc(actor.name)}`,
    threshold: rollStatLine({ label: "Common Lore (War)+0", base, parts: ruleMods.parts, threshold, rv }),
    outcome: success
      ? `<span class="roll-success">Успех — сочленения цели определены по памяти: штраф «Скрытые Сочленения» (+10) снят для этой атаки.</span>`
      : `<span class="roll-failure">Провал — ${deg} ${_degWord(deg)}: штраф «Скрытые Сочленения» остаётся.</span>`
  }, { rolls: [roll] });
  return { success, roll: rv, threshold, deg };
}

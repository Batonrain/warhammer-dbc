// module/combat/bulldoze.mjs
// ════════════════════════════════════════════════════════════════════════
//  НАПРОЛОМ (стр. 31, wdbc-x1nz.2.65) — эффект победы в состязании
//  (MELEE_CONTESTS.bulldoze), подмешивается в module/sheets/tabs/combat.mjs
//  тем же приёмом, что Финт/Давление (combat/feint-press.mjs).
//
//  ЧЕСТНО НЕ АВТОМАТИЗИРОВАНО: книга описывает ОДИН бросок мовера против
//  ВСЕХ врагов на пути ПО ОЧЕРЕДИ (свой встречный порог у каждого,
//  штраф −10×разница Размера у меньших, остановка перед первым победившим).
//  _showContestDialog (techniques.mjs) — общий диалог на ОДНОГО оппонента,
//  без очереди/нескольких целей; развернуть его в полноценный многоцелевой
//  резолвер — отдельная, более крупная задача (тот же честный предел, что
//  уже был в note самого MELEE_CONTESTS.bulldoze). Здесь автоматизировано:
//  штраф −10×разница Размера против ВЫЦЕЛЕННОГО противника (подсказка в
//  Доп. модификаторе диалога), жёсткий запрет ролла против цели на 1+
//  Размер крупнее, и последствия победы ПРОТИВ ЭТОЙ цели — Свободная Атака
//  не срабатывает (тот же флаг, что «Выход из Боя»), 5+ Успехов — Ничком +
//  напоминание про Пинок (интегральное оружие, не отдельный бросок урона
//  сам по себе — обычная рукопашная атака им).
// ════════════════════════════════════════════════════════════════════════

import { esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { postTestCard, outcomeHtml } from "../helpers/test-card.mjs";
import { conditionApplyFields } from "../sheets/tabs/conditions.mjs";

/** Разница в Размере (мовер − цель); >0 — цель МЕНЬШЕ. */
export function bulldozeSizeDiff(actor, target) {
  return (Number(actor?.system?.size) || 0) - (Number(target?.system?.size) || 0);
}

/** «Нельзя против противников на 1+ Размер больше персонажа» — жёсткий запрет. */
export function bulldozeForbidden(actor, target) {
  return bulldozeSizeDiff(actor, target) <= -1;
}

/** Подсказанный штраф −10 за уровень разницы (только если цель МЕНЬШЕ). */
export function bulldozeSizePenalty(actor, target) {
  const diff = bulldozeSizeDiff(actor, target);
  return diff > 0 ? -10 * diff : 0;
}

export async function resolveBulldozeSuccess(actor, { deg, target } = {}) {
  if (!target) {
    return ui.notifications?.warn(`${actor.name}: цель Напролома не выцелена на сцене — эффект не наложен.`);
  }
  // Не получает Свободных Атак (стр. 31) — то же разовое «на одно движение»
  // освобождение, что «Выход из Боя» (movement-actions.mjs::declareDisengage);
  // само движение (Натиск/Бег) книжной дистанцией не автоматизировано.
  await actor.setFlag("warhammer-dbc", "disengageActive", true);
  const sections = [
    `<div class="roll-threshold">Персонаж проходит мимо ${esc(target.name)}, не получая от неё Свободной Атаки.</div>`
  ];
  if (deg >= 5) {
    const fields = conditionApplyFields("prone", null, target);
    if (Object.keys(fields).length) await target.update(fields);
    sections.push(`<div class="roll-threshold">5+ Успехов: ${esc(target.name)} сбит(а) с ног и получает попадание Пинком или оружием на ноге персонажа — разыграйте обычной рукопашной атакой этим оружием (стр. 40).</div>`);
  }
  await postTestCard(actor, {
    icon: rollIcon("sword", "#e08a3a"),
    title: `Напролом: ${esc(target.name)}`,
    outcome: outcomeHtml(true, "Проход успешен"),
    sections
  }, { sound: false });
}

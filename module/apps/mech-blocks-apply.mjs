// module/apps/mech-blocks-apply.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Применение блоков Requirement+Condition+Effect (doombc-req-condition-
//  effect-plan) — Foundry-обвязка поверх чистой логики module/rules/
//  mech-blocks.mjs (blocksFiring) и уже существующего применителя Effect —
//  applyMechEntry() из mechanics.mjs (переиспользован как есть, не дублирован).
//
//  Живёт в apps/, не в rules/: applyMechEntry тянет Foundry (Dialog,
//  ChatMessage, foundry.utils) — импортировать его из module/rules/ сломало бы
//  инвариант «rules/ без Foundry», на котором держится тестируемость всего
//  остального rules/ (predicates.mjs, elite-requirements.mjs, requirements.mjs,
//  conditions.mjs, mech-blocks.mjs — все они пока проверяются без стенда).
// ════════════════════════════════════════════════════════════════════════════

import { blocksFiring } from "../rules/mech-blocks.mjs";
import { applyMechEntry } from "./mechanics.mjs";

/**
 * Применяет Effects всех блоков предмета, что сработали на событие, — по
 * очереди, тем же applyMechEntry(), что и старый формат groups.
 *
 * @param {Item}   item     предмет, несущий flags.warhammer-dbc.mechBlocks
 * @param {Actor}  actor    владелец
 * @param {object} event    { kind, ... } — см. module/rules/conditions.mjs
 * @param {Set}    applied  общая метка применённых entry.id — как у
 *                          applyMechEntry/applyGroupEntries. По умолчанию
 *                          новый Set на каждый вызов (эффекты применятся
 *                          заново при повторном вызове с тем же event) —
 *                          персистентную идемпотентность между отдельными
 *                          срабатываниями события должен обеспечить вызывающий
 *                          код (передать Set, восстановленный из флага), это
 *                          НЕ сделано здесь намеренно — живая врезка событий
 *                          ещё не подключена (см. подвал conditions.mjs).
 * @returns {number} сколько блоков сработало (для лога/отладки)
 */
export async function applyMechBlocks(item, actor, event, applied = new Set()) {
  const firing = blocksFiring(actor, item, event);
  for (const block of firing) {
    for (const entry of block.effects || []) {
      await applyMechEntry(actor, entry, item, false, applied);
    }
  }
  return firing.length;
}

/**
 * То же самое, но по ВСЕМ предметам актора — для событий, не привязанных к
 * получению ОДНОГО конкретного предмета (понижение Ран, трата ресурса, роль
 * в отряде и т.п.): каждый предмет актора может нести блок с нужным Condition,
 * а звать точку события должна одна строка на месте события, не цикл по
 * предметам заново в каждом файле.
 *
 * @returns {number} суммарно сколько блоков сработало по всем предметам
 */
export async function applyMechBlocksForActor(actor, event) {
  let total = 0;
  for (const item of [...(actor?.items ?? [])]) {
    total += await applyMechBlocks(item, actor, event);
  }
  return total;
}

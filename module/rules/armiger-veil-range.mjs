// module/rules/armiger-veil-range.mjs
// ════════════════════════════════════════════════════════════════════════
//  Радиус «Завеса тоньше» демона-Оруженосца (wdbc-1rno, шаг F): «...считает
//  Завесу на Cor.b персонажа тоньше, чем на самом деле, ЕСЛИ НЕ ОТХОДИТ ОТ
//  НЕГО ДАЛЬШЕ ЧЕМ НА Cor м». Два разных числа одного Хозяина в одной фразе:
//  прибавка к тесту — Cor.b (бонус, module/rules/resolve-test.mjs
//  masterCharBonus:"cor"), а вот дальность — полное значение Порчи
//  (system.corruption.value), не бонус. Без обоих токенов на одной сцене
//  дистанцию не измерить — тогда бонус не даётся (в отличие от книжного
//  разрешения сомнений в пользу игрока, здесь это явное числовое условие,
//  а не абстрактная формулировка).
// ════════════════════════════════════════════════════════════════════════

import { tokenDocDistance } from "../regions/auras.mjs";

/**
 * Хозяин в пределах Cor м от демона (по их живым токенам на текущей сцене)?
 * @param {Actor} demonActor
 * @param {Actor} masterActor
 * @returns {boolean}
 */
export function masterWithinVeilRange(demonActor, masterActor) {
  if (!demonActor?.uuid || !masterActor?.uuid) return false;
  const placeables = canvas?.tokens?.placeables ?? [];
  const demonToken  = placeables.find(t => t.actor?.uuid === demonActor.uuid)?.document;
  const masterToken = placeables.find(t => t.actor?.uuid === masterActor.uuid)?.document;
  if (!demonToken || !masterToken || demonToken.parent !== masterToken.parent) return false;
  const corValue = Number(masterActor.system?.corruption?.value) || 0;
  return tokenDocDistance(demonToken, masterToken, demonToken.parent.grid) <= corValue;
}

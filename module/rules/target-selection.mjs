// module/rules/target-selection.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Target Selection / Выбор Целей (core.json, «Стрелок», Sahara 3-5fbf):
//  «Персонаж может стрелять в цели, связанные в ближнем бою, без штрафов, а его
//  промахи никогда не попадают в союзников (но могут в других врагов)».
//
//  Первая половина (штраф −20 «Цель связана в рукопашной») снята в
//  sheets/attack/mods.mjs. Здесь — вторая: кому достаётся промах по цели,
//  Связанной в Рукопашной (стр. 30): книга бросает случайного участника
//  контакта «враг или союзник», а у носителя Таланта союзники выпадают из
//  списка. Остаются враги и нейтралы; если больше никого нет, промах уходит
//  в никуда (ни в кого не попадает).
//
//  «Союзник» — как у regions/auras.mjs::tokenRelationship: оба токена Hostile или
//  оба Friendly (Neutral/Secret — ни чьи союзники). Сам стрелок в списке
//  не оставляется ни при каких условиях: он стоит в контакте с целью, но
//  ранить самого себя промах не может, а своим союзником он, конечно, является.
//
//  Чистая логика: токены приходят как {id, disposition}, Foundry не нужен.
// ════════════════════════════════════════════════════════════════════════════

import { hasAbility } from "./ability-by-key.mjs";

export const TARGET_SELECTION = Object.freeze({ key: "rangedCore.core.targetSelection", name: "Target Selection" });

export const hasTargetSelection = actor => hasAbility(actor, TARGET_SELECTION.key, TARGET_SELECTION.name, "talent");

/** Союзники ли два токена по расположению (как auras.mjs::tokenRelationship === "ally"). */
export function dispositionsAreAllies(a, b) {
  const s = Number(a) || 0, t = Number(b) || 0;
  return Math.abs(s) === 1 && s === t;
}

/**
 * Список участников контакта, в которых может уйти промах.
 *
 * @template {{id?: string, disposition?: number}} T
 * @param {T[]} contact              токены в контакте с целью (allContactTokenDocs)
 * @param {object} o
 * @param {boolean} o.targetSelection  у стрелка есть Талант
 * @param {string}  [o.shooterTokenId] токен стрелка (если он стоит в контакте — его не трогаем)
 * @param {number}  [o.shooterDisposition]
 * @returns {T[]} без Таланта — исходный список; с Талантом — без стрелка и его союзников
 */
export function misfireCandidates(contact, { targetSelection = false, shooterTokenId = "", shooterDisposition = 0 } = {}) {
  const list = Array.isArray(contact) ? contact : [];
  if (!targetSelection) return list;
  return list.filter(t => t?.id !== shooterTokenId && !dispositionsAreAllies(shooterDisposition, t?.disposition));
}

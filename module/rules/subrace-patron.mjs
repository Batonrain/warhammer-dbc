// module/rules/subrace-patron.mjs
// ════════════════════════════════════════════════════════════════════════════
//  «Не может потерять покровительство <Бога>» — субрасы Зверолюда (корбук
//  гл. I: Слаангор, Пестигор, Кхорнгор, Тзаангор). Бог субрасы хранится
//  подписью («Слаанеш») в system.god предмета-субрасы; поле актора
//  system.patronGod — ключом (constants/chaos-patron.mjs). Здесь только
//  перевод подписи в ключ и решение «пропустить ли смену покровителя»;
//  хук preUpdateActor — module/hooks.mjs, выдача при взятии субрасы —
//  apps/races.mjs::applySubrace. Без Foundry.
// ════════════════════════════════════════════════════════════════════════════

import { CHAOS_PATRONS } from "../constants/chaos-patron.mjs";

/** «Слаанеш» / «slaanesh» → "slaanesh"; незнакомое — "". */
export function patronKeyOfGod(god) {
  const g = String(god || "").trim().toLowerCase();
  if (!g) return "";
  return CHAOS_PATRONS.find(p => p.key === g || p.label.toLowerCase() === g)?.key || "";
}

/**
 * Какой покровитель должен остаться после правки. null — правка не трогает
 * покровителя или не спорит с субрасой; иначе ключ закреплённого Бога.
 *
 * @param {string} lockedKey  Бог субрасы (ключ), "" — субраса ничего не держит
 * @param {string|undefined} nextPatron  system.patronGod из правки
 */
export function enforcedPatron(lockedKey, nextPatron) {
  if (!lockedKey || nextPatron === undefined) return null;
  return nextPatron === lockedKey ? null : lockedKey;
}

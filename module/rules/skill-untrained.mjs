// module/rules/skill-untrained.mjs
// Сноска ² (книга, стр. 57): Psyniscience и Forbidden Lore (а у групп — Operate
// Aeronautica/Voidship) нельзя использовать неизученными — тест недоступен
// вовсе, а не −20. Лист персонажа проверяет это сам (actor-sheet.mjs::
// blockedUntrained); здесь та же проверка для обходных путей — делегированный
// тест от эффекта, ответ во встречном тесте, лист Орды (Sahara task-8f82).

import { SKILLS_DEF } from "../constants/skills.mjs";

/** Нельзя бросать: одиночный Навык с cannotUntrained и rank «untrained». */
export function skillBlockedUntrained(actor, skillKey) {
  const def = SKILLS_DEF[skillKey];
  if (!def?.cannotUntrained) return false;
  return (actor?.system?.skills?.[skillKey]?.rank ?? "untrained") === "untrained";
}

/** То же с предупреждением; true — бросок отменён. */
export function warnSkillBlockedUntrained(actor, skillKey) {
  if (!skillBlockedUntrained(actor, skillKey)) return false;
  const label = SKILLS_DEF[skillKey]?.label ?? skillKey;
  globalThis.ui?.notifications?.warn(`${actor?.name ?? ""}: ${label} нельзя использовать неизученным — тест не проводится.`);
  return true;
}

// module/rules/friendly-specialties.mjs
// ════════════════════════════════════════════════════════════════════════════
//  «Дружественные специализации» с Родного мира (Исследовательская станция,
//  «Погоня за знаниями»): отмеченные при создании специализации Групп Навыков
//  всегда считаются Дружественными при покупке за опыт (как и Общие знания/
//  Ремесло целиком — stub.alwaysAlly), даже когда сама группа таковой не
//  является и Склонности/культура легиона говорят иначе.
// ════════════════════════════════════════════════════════════════════════════

const norm = s => String(s || "").toLowerCase().trim();

/** Ключ хранения/сравнения в system.homeworld.friendlySpecs: "group:specialty". */
export function friendlySpecKey(group, specialty) {
  return `${norm(group)}:${norm(specialty)}`;
}

/** Отмечена ли эта специализация Группы Навыков как Дружественная на Родном мире? */
export function isFriendlySpecialty(actor, group, specialty) {
  if (!group || !specialty) return false;
  const hw = actor?.items?.find(i => i.type === "homeworld");
  const list = hw?.system?.friendlySpecs;
  if (!Array.isArray(list) || !list.length) return false;
  return list.includes(friendlySpecKey(group, specialty));
}

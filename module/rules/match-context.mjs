// module/rules/match-context.mjs
//
// Матчер ситуативных модификаторов по контексту броска. Раньше лежал в
// constants/homeworlds.mjs и раздавался оттуда листу персонажа — контентный
// файл не должен владеть механизмом, поэтому переехал сюда.

/**
 * Подходит ли модификатор к контексту броска. Тем же матчером пользуются
 * Особенности Происхождения (constants/homeworlds.mjs, homeworldRollMods) и
 * предметные ситуативные модификаторы Черт, Талантов и Снаряжения — см.
 * WarhammerCharacterSheet#_itemRollModsHtml в sheets/actor-sheet.mjs.
 */
export function matchesContext(when = {}, ctx = {}) {
  if (when.kind !== ctx.kind) return false;
  if (when.skill && when.skill !== ctx.skill) return false;
  if (when.group && when.group !== ctx.group) return false;
  if (when.specialty && !String(ctx.specialty || "").toLowerCase().includes(when.specialty.toLowerCase())) return false;
  if (when.char && when.char !== ctx.char) return false;
  // Флаговые контексты: модификатор просится только в помеченный бросок.
  if (when.suppression && !ctx.suppression && !(when.addiction && ctx.addiction)) return false;
  if (when.single && !ctx.single) return false;
  if (when.target && !ctx.target) return false;
  return true;
}

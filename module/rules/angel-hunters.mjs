// module/rules/angel-hunters.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Angel Hunters / Охотники на Ангелов (Йигори, корбук, глава I): «Раз в Раунд
//  Йигори может перебросить любой тест, целью или источником которого является
//  Космодесантник. Йигори в одном Командном Присутствии и в пределах видимости
//  друг друга могут делиться этими перебросами между собой» (wdbc-erp61).
//
//  Чистая часть: ключи и «одно ли Командное Присутствие». Сцена, поле зрения и
//  метка «потрачено» — combat/angel-hunters.mjs; сам переброс — правило
//  rules/library/yigori.mjs (effect.limit).
// ════════════════════════════════════════════════════════════════════════════

/** Ключ ограничителя (effect.limit правила и rules/roll-mods.mjs::rerollLimiters). */
export const ANGEL_HUNTERS_LIMIT = "angelHunters";

/** Метка «раз в Раунд» на акторе (rules/cooldown.mjs, flags.usageLimits.<ключ>). */
export const ANGEL_HUNTERS_USAGE = "yigori.angelHunters";

/** Название Черты — по нему отбирается, кто может делиться. */
export const ANGEL_HUNTERS_TRAIT = "Angel Hunters";

/**
 * Одно ли Командное Присутствие у двух акторов: один Отряд, один командир
 * («Под моим Присутствием»), либо один из них — командир другого.
 * @param {{uuid:string, squadId?:string, commandedBy?:string}} a
 * @param {{uuid:string, squadId?:string, commandedBy?:string}} b
 */
export function sameCommandPresence(a, b) {
  if (!a || !b || !a.uuid || !b.uuid || a.uuid === b.uuid) return false;
  if (a.squadId && a.squadId === b.squadId) return true;
  if (a.commandedBy && a.commandedBy === b.commandedBy) return true;
  return (!!a.commandedBy && a.commandedBy === b.uuid) || (!!b.commandedBy && b.commandedBy === a.uuid);
}

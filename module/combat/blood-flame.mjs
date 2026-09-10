// module/combat/blood-flame.mjs
//
// Кровавое Пламя (wdbc-1rno, Дар Кхорна) — боевой такт двух моментов, что не
// умещаются в activateBloodFlame (apps/blood-flame.mjs): «убил этим оружием»
// (растёт бонус урона) и «бой/сцена кончились» (оружие ломается).

import { isBloodFlameActive, ACTIVE_FLAG, KILLS_FLAG, ADDED_PROPS_FLAG, SOURCE_FLAG } from "../rules/blood-flame.mjs";

const FLAG = "warhammer-dbc";

/**
 * Чем жертву ранили в последний раз. Ставит конвейер урона (combat/damage.mjs),
 * читает sheets/tabs/body.mjs::setDeceased — чтобы засчитать убийство Кровавому
 * Пламени в тот момент, когда система признаёт смерть, а не только по редкой
 * крит-строке с явным глаголом смерти.
 */
export const LAST_DAMAGE_WEAPON_FLAG = "lastDamageWeaponUuid";

/**
 * Убийство этим оружием — module/hooks.mjs зовёт после setDeceased(actor,
 * true), когда крит-кнопка «Констатировать смерть»
 * (combat/crit-effect-parser.mjs::deathButtonHtml) несёт weaponUuid и он
 * резолвится в РЕАЛЬНЫЙ предмет-оружие. Молча выходит, если на оружии
 * Кровавое Пламя не горит — считать тут нечего (обычное убийство обычным
 * оружием, или Пламя уже погасло).
 */
export async function registerBloodFlameKill(weapon) {
  if (!isBloodFlameActive(weapon)) return;
  const kills = (Number(weapon.getFlag(FLAG, KILLS_FLAG)) || 0) + 1;
  await weapon.setFlag(FLAG, KILLS_FLAG, kills);
}

/**
 * Конец боя/сцены (module/hooks.mjs::deleteCombat) — «оружие ломается и
 * бесполезно, пока не будет починено» книга говорит прямым текстом, в
 * отличие от Reformation Song (combat/reformation-song.mjs), которая
 * destroyed сознательно НЕ трогает при своей уборке «до конца боя». Снимает
 * добавленные свойства (сломанному оружию Power Field/Flame ни к чему) и
 * оба флага активации.
 */
export async function clearBloodFlameBuffs(combat) {
  for (const c of combat?.combatants ?? []) {
    await breakBloodFlameWeapons(c.actor);
  }
}

/**
 * «…или сцены» — вторая половина книжного условия, до сих пор не
 * реализованная: конец боя ловился по deleteCombat, а конец СЦЕНЫ — ничем.
 * Если ГМ не удалял встречу или носитель Дара вовсе не был в трекере, оружие
 * горело бесконечно, со всеми накопленными «+2 за убитого».
 *
 * Зовётся кнопками «🎬 Сцена» и «⏻ Сессия» (apps/game-session.mjs) — тем же
 * общим механизмом конца сцены, что откатывает метки usageLimit.
 */
export async function breakBloodFlameOnSceneEnd() {
  for (const actor of game.actors ?? []) await breakBloodFlameWeapons(actor);
}

/**
 * Дар сняли с персонажа (ГМ передумал, откатил Порчу) — Пламя должно погаснуть
 * вместе с ним. Флаги и добавленные свойства лежат на ОРУЖИИ, а Дар — отдельный
 * предмет, поэтому Foundry сам ничего не чистит; без этой уборки оружие
 * оставалось силовым, пламенным и с накопленным бонусом, и снять это было
 * нечем, кроме ручной правки. Тот же приём и та же точка (deleteItem), что у
 * apps/hand-of-death.mjs::cleanupHandOfDeath.
 *
 * Оружие при этом НЕ ломается: книжная поломка — цена за проведённый бой, а не
 * за снятие Дара.
 */
export async function cleanupBloodFlame(actor, deletedItemId) {
  if (!actor?.items || !deletedItemId) return;
  if (actor.items.get(deletedItemId)) return;   // удалили не источник — не наш случай
  for (const item of [...actor.items]) {
    if (!isBloodFlameActive(item)) continue;
    if (item.getFlag(FLAG, SOURCE_FLAG) !== deletedItemId) continue;
    await clearBloodFlameFlags(item, { destroyed: false });
  }
}

/** Погасить Пламя на всём оружии актора и сломать его (конец боя/сцены). */
async function breakBloodFlameWeapons(actor) {
  if (!actor?.items) return;
  for (const item of [...actor.items]) {
    if (!isBloodFlameActive(item)) continue;
    await clearBloodFlameFlags(item, { destroyed: true });
  }
}

/** Снять добавленные свойства и флаги Пламени; сломать оружие, если сказано. */
async function clearBloodFlameFlags(item, { destroyed }) {
  const addedKeys = item.getFlag(FLAG, ADDED_PROPS_FLAG) || [];
  const props = (item.system?.weaponProps || []).filter(p => !addedKeys.includes(p?.key));
  await item.update({
    "system.weaponProps": props,
    ...(destroyed ? { "system.destroyed": true } : {}),
    [`flags.${FLAG}.-=${ACTIVE_FLAG}`]: null,
    [`flags.${FLAG}.-=${KILLS_FLAG}`]: null,
    [`flags.${FLAG}.-=${ADDED_PROPS_FLAG}`]: null,
    [`flags.${FLAG}.-=${SOURCE_FLAG}`]: null
  });
}

// module/combat/blood-flame.mjs
//
// Кровавое Пламя (wdbc-1rno, Дар Кхорна) — боевой такт двух моментов, что не
// умещаются в activateBloodFlame (apps/blood-flame.mjs): «убил этим оружием»
// (растёт бонус урона) и «бой/сцена кончились» (оружие ломается).

import { isBloodFlameActive, ACTIVE_FLAG, KILLS_FLAG, ADDED_PROPS_FLAG } from "../rules/blood-flame.mjs";

const FLAG = "warhammer-dbc";

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
    const actor = c.actor;
    if (!actor?.items) continue;
    for (const item of [...actor.items]) {
      if (!isBloodFlameActive(item)) continue;
      const addedKeys = item.getFlag(FLAG, ADDED_PROPS_FLAG) || [];
      const props = (item.system?.weaponProps || []).filter(p => !addedKeys.includes(p?.key));
      await item.update({
        "system.weaponProps": props,
        "system.destroyed": true,
        [`flags.${FLAG}.-=${ACTIVE_FLAG}`]: null,
        [`flags.${FLAG}.-=${KILLS_FLAG}`]: null,
        [`flags.${FLAG}.-=${ADDED_PROPS_FLAG}`]: null
      });
    }
  }
}

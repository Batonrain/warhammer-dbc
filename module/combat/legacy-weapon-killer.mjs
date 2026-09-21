// module/combat/legacy-weapon-killer.mjs
// ════════════════════════════════════════════════════════════════════════
//  Убийца/fearsome 9-9, Оружие Наследия (wdbc-1rno.35, стр. 427): активация
//  (тратит Очко Бесчестия, даёт Felling(Inf.b)/+1 к рейтингу до конца боя) —
//  module/apps/legacy-weapon.mjs::activateKillerLegacyFelling, весь этот
//  модуль — только откат по концу боя, тем же приёмом (флаг-ревёрт на
//  предмете), что module/combat/reformation-song.mjs::
//  clearReformationSongBuffs.
// ════════════════════════════════════════════════════════════════════════

import { LEGACY_KILLER_FELLING_FLAG } from "../rules/legacy-weapon.mjs";

/**
 * Снимает временный грант Felling Убийцы со всех Оружий Наследия участников
 * боя — звать в module/hooks.mjs::deleteCombat, тем же тактом, что
 * clearReformationSongBuffs/clearBloodFlameBuffs и соседи.
 */
export async function clearLegacyKillerBuffs(combat) {
  for (const c of combat?.combatants ?? []) {
    const actor = c.actor;
    if (!actor?.items) continue;
    for (const item of [...actor.items]) {
      const revert = item.getFlag?.("warhammer-dbc", LEGACY_KILLER_FELLING_FLAG);
      if (!revert) continue;
      const props = [...(item.system?.weaponProps ?? [])];
      const idx = props.findIndex(p => p?.key === "felling");
      if (idx !== -1) {
        if (revert.originalRating == null) props.splice(idx, 1);
        else props[idx] = { ...props[idx], rating: revert.originalRating };
        await item.update({ "system.weaponProps": props });
      }
      await item.unsetFlag("warhammer-dbc", LEGACY_KILLER_FELLING_FLAG);
    }
  }
}

// module/combat/wrapped-in-chaos.mjs
//
// Wrapped in Chaos/Укутанный в Хаос (wdbc-1rno) — конец боя (module/hooks.mjs
// ::deleteCombat) снимает Tainted, добавленный «Осквернённым Клинком» (тот
// же приём, что уже даёт Blood Flame/Кровавое Пламя, combat/blood-flame.mjs::
// clearBloodFlameBuffs — только снятие свойства, оружие не ломается).

import { TAINTED_BLADE_ADDED_FLAG } from "../rules/wrapped-in-chaos.mjs";

const FLAG = "warhammer-dbc";

/** Снять Tainted, добавленный этой находкой, со всего оружия акторов боя. */
export async function clearTaintedBladeBuffs(combat) {
  for (const c of combat?.combatants ?? []) {
    for (const item of [...(c.actor?.items ?? [])]) {
      if (!item.getFlag?.(FLAG, TAINTED_BLADE_ADDED_FLAG)) continue;
      const props = (item.system?.weaponProps ?? []).filter(p => p?.key !== "tainted");
      await item.update({
        "system.weaponProps": props,
        [`flags.${FLAG}.-=${TAINTED_BLADE_ADDED_FLAG}`]: null
      });
    }
  }
}

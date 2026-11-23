// module/combat/combat-end-marks.mjs
// Метки «до следующего Хода / до броска», которые без конца боя жили вечно (приёмка #597):
//  • Танец Пламени (fireDancePanic) — −40 к первому тесту Паники; огонь погас без теста — метка висела
//    и била по следующему пожару;
//  • «до конца своего следующего Хода» (conditionUntilTurnEnd, Варп Вспышка) — Хода больше нет,
//    а метка держала Состояние мимо общего счётчика Раундов: Ослепление навсегда;
//  • Секуторий (secutorPin) — щит прижимал оружие и после боя;
//  • Таран Поглотителя (devourerRam) — метка Напролома без движения.
// Снимает активный ГМ на deleteCombat (hooks.mjs) у участников боя.

import { FIRE_DANCE_PANIC_FLAG } from "../rules/fire-dance.mjs";
import { SECUTOR_PIN_FLAG } from "../rules/gladiator-arena.mjs";
import { DEVOURER_RAM_FLAG } from "../rules/terminator-talents.mjs";
import { UNTIL_TURN_END_FLAG } from "../rules/until-turn-end.mjs";

const NS = "warhammer-dbc";
export const COMBAT_END_FLAGS = Object.freeze([FIRE_DANCE_PANIC_FLAG, SECUTOR_PIN_FLAG, DEVOURER_RAM_FLAG, UNTIL_TURN_END_FLAG]);

/** Заплатка снятия меток боя актора (чистая функция); removeFields(key) — поля снятия Состояния. */
export function combatEndMarksPatch(actor, removeFields = () => ({})) {
  const flags = actor?.flags?.[NS] ?? {};
  const patch = {};
  for (const f of COMBAT_END_FLAGS) if (flags[f] != null) patch[`flags.${NS}.-=${f}`] = null;
  // Состояния «до конца Хода» сняты вместе с меткой: их Ход уже не наступит.
  for (const key of Object.keys(flags[UNTIL_TURN_END_FLAG] ?? {})) Object.assign(patch, removeFields(key));
  return patch;
}

/** Конец боя: снять метки у участников. */
export async function clearCombatEndMarks(combat) {
  const { conditionRemoveFields } = await import("../sheets/tabs/conditions.mjs");
  const seen = new Set();
  for (const c of combat?.combatants ?? []) {
    const a = c?.actor;
    if (!a || seen.has(a.uuid)) continue;
    seen.add(a.uuid);
    const patch = combatEndMarksPatch(a, conditionRemoveFields);
    if (Object.keys(patch).length) await a.update(patch);
  }
}

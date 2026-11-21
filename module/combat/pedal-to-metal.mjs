// module/combat/pedal-to-metal.mjs
// Кнопка Таланта «Педаль в Пол» (rules/pedal-to-metal.mjs): водитель ставит машине метку
// +P.b к SPD; Вираж до начала его следующего Хода недоступен (combat/vehicle.mjs).

import { esc } from "../helpers/utils.mjs";
import { stationOf } from "../rules/vehicle.mjs";
import { PEDAL_FLAG, hasPedalToMetal, pedalOf, pedalExpired } from "../rules/pedal-to-metal.mjs";

const DRIVER_ROLES = ["driver", "pilot"];

export async function usePedalToMetal(driver) {
  if (!driver || !hasPedalToMetal(driver)) return ui.notifications.warn("⚠️ У актора нет Таланта Педаль в Пол.");
  const at = stationOf(driver.uuid, [...(game.actors ?? [])]);
  const role = String(at?.station?.role ?? "").trim().toLowerCase();
  if (!at || !DRIVER_ROLES.includes(role)) return ui.notifications.warn(`⚠️ ${driver.name} не за рулём: посадите его водителем на вкладке «Экипаж» машины.`);
  const vehicle = at.vehicle;
  if (!vehicle.isOwner) return ui.notifications.warn(`⚠️ Нет прав на ${vehicle.name}.`);
  const bonus = Number(driver.system?.characteristics?.per?.bonus) || 0;
  const c = game.combat;
  await vehicle.setFlag("warhammer-dbc", PEDAL_FLAG, {
    bonus, driverUuid: driver.uuid, combatId: c?.id ?? "", round: Number(c?.round) || 0, turn: Number(c?.turn) || 0
  });
  await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: driver }),
    content: `<div class="wh-roll-result"><div class="roll-header">Педаль в Пол — ${esc(vehicle.name)}</div>
      <div class="roll-threshold">SPD +${bonus} (P.b водителя). В этот Ход машина не поворачивает; до начала следующего Хода ${esc(driver.name)} — без Виражей.</div></div>` });
  return bonus;
}

/**
 * Начало Хода в бою: снять истёкшие метки «Педали в Пол». Без снятия effSpd
 * машины держал прибавку, пока лист не пересчитают (живая проверка pr-584-pedal-spd-stale);
 * unsetFlag сам вызывает пересчёт производных. Пишет один активный ГМ (hooks.mjs).
 */
export async function expirePedalMarks(combat) {
  const seen = new Set();
  const vehicles = [
    ...[...(game.actors ?? [])].filter(a => a.type === "vehicle"),
    ...[...(combat?.combatants ?? [])].map(c => c.actor).filter(a => a?.type === "vehicle")
  ];
  for (const v of vehicles) {
    if (!v || seen.has(v.uuid)) continue;
    seen.add(v.uuid);
    if (pedalExpired(pedalOf(v), combat)) await v.unsetFlag("warhammer-dbc", PEDAL_FLAG);
  }
}

// module/rules/range-penalty-immunity.mjs
// ════════════════════════════════════════════════════════════════════════
//  Кто снимает штраф дальней (−10) и экстремальной (−30) дистанции
//  (wdbc-1rno.31). Сам штраф уже отмечается окном атаки по замеренной
//  дистанции (sheets/attack/mods.mjs, RANGE_BANDS rules/tactical-map.mjs) —
//  здесь только гасители, по книге:
//   • Marksman / Снайпер (core, стр. 62): «не получает штрафов к стрельбе за
//     дальнюю и экстремальную дистанцию»;
//   • Cold Eyes / Холодные Глаза (стр. 243) — то же;
//   • Optical Sight / Оптический Прицел и Djinn Sight / Джинн-Прицел (стр.
//     171) — то же, но с меткой «(Прицеливание)»: только когда стрелок
//     прицелился (system.aiming, ставит HUD — combat/aiming-action.mjs).
//  Чистая логика без Foundry.
// ════════════════════════════════════════════════════════════════════════

import { itemIs } from "./item-marker.mjs";
import { hasColdEyes } from "./cold-eyes.mjs";

export const MARKSMAN_CAPABILITY = "rangedCore.core.marksman";
const AIM_SCOPES = ["Optical Sight", "Djinn Sight"];

/**
 * Причина (подпись для строки окна атаки), по которой штраф дальней и
 * экстремальной дистанции не действует, либо null.
 * @param {object} actor
 * @param {object[]} installedMods  модификации, установленные на это оружие
 * @param {{aiming?: string}} [opts]  system.aiming стрелка
 */
export function longRangeImmunityReason(actor, installedMods = [], { aiming = "" } = {}) {
  const items = [...(actor?.items ?? [])];
  if (items.some(i => itemIs(i, "talent", MARKSMAN_CAPABILITY, "Marksman"))) return "Снайпер";
  if (hasColdEyes(actor)) return "Холодные Глаза";
  if (aiming && aiming !== "none") {
    const scope = installedMods.find(m => AIM_SCOPES.some(n => itemIs(m, "weaponMod", null, n)));
    if (scope) return `${String(scope.name).split("/").pop().trim()} (Прицеливание)`;
  }
  return null;
}

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
//     прицелился (system.aiming, ставит HUD — combat/aiming-action.mjs);
//   • Omni-Sight / Омни-Прицел — «комбинирует эффекты всех остальных»
//     (Sahara task-e683): отвечает «да» через rules/sight-effects.mjs.
//  Чистая логика без Foundry.
// ════════════════════════════════════════════════════════════════════════

import { itemIs } from "./item-marker.mjs";
import { hasColdEyes } from "./cold-eyes.mjs";
import { sightGrants, SIGHT_EFFECT } from "./sight-effects.mjs";
import { runicArtilleryActive } from "./runic-shot.mjs";

/**
 * Рунная Артиллерия (Питати): «Совершая рунный выстрел после Полного
 * Прицеливания при поддержании Preternatural Awareness, игнорирует штрафы за
 * дальнюю и экстремальную дистанцию». Окно атаки помечает строки дальности
 * (data-runic-artillery), и форма не берёт их в Порог, пока отмечена «Рунная
 * пуля» на одиночном выстреле (sheets/attack/form.mjs::runicArtilleryWaived).
 */
export function runicArtilleryMarks(actor, { aiming = "" } = {}) {
  return runicArtilleryActive(actor, { aiming });
}

export const MARKSMAN_CAPABILITY = "rangedCore.core.marksman";

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
  // Рунная Артиллерия (Питати) сюда не входит: она гасит штраф только РУННОМУ
  // выстрелу, а это видно лишь по галочке «Рунная пуля» в самом окне —
  // runicArtilleryRow ниже и sheets/attack/form.mjs.
  if (aiming && aiming !== "none") {
    // Оптический, Джинн и Омни-Прицел (rules/sight-effects.mjs).
    const scope = sightGrants(installedMods, SIGHT_EFFECT.longRange);
    if (scope) return `${String(scope.name).split("/").pop().trim()} (Прицеливание)`;
  }
  return null;
}

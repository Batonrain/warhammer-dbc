// module/combat/adrenaline-rush.mjs
// ════════════════════════════════════════════════════════════════════════
//  Adrenaline Rush / Прилив Адреналина (wdbc-ks1r, dodge.core.adrenalineRush,
//  найдено при аудите wdbc-sk8s): «Раз за бой или сцену персонаж может
//  потратить Очко Бесчестия, чтобы восстановить все потраченные Реакции и
//  потраченную дистанцию отскока».
//
//  «Раз за бой ИЛИ сцену» — та же неоднозначная формулировка, что у
//  Resplendent Raiment (module/combat/resplendent-raiment.mjs) — переиспользуется
//  тот же resplendentUnit(), не заводится дубль.
//
//  «Дистанция отскока» (wdbc-2b93, после мерджа PR #308): раньше движок её не
//  трекал вовсе (текстовый честный компромисс, тот же принцип, что Deadly
//  Effectiveness, wdbc-1rno) — теперь манёвр «Отскок» реализован (wdbc-9wvm,
//  module/combat/recoil-pool.mjs), и «восстановить дистанцию Отскока»
//  означает полный сброс пула этого Раунда (resetRecoilPool) — то же, что
//  «потраченного не было».
// ════════════════════════════════════════════════════════════════════════

import { itemHasName } from "../rules/predicates.mjs";
import { isThrottleReady, markThrottleUsed } from "../rules/cooldown.mjs";
import { resplendentUnit } from "./resplendent-raiment.mjs";
import { effectiveDefenseReactionMax } from "./action-economy.mjs";
import { resetRecoilPool } from "./recoil-pool.mjs";
import { esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { postTestCard } from "../helpers/test-card.mjs";

const FLAG = "dodge.core.adrenalineRush";

/** Владеет ли актор Талантом Adrenaline Rush / Прилив Адреналина. */
export function hasAdrenalineRush(actor) {
  return !!actor?.items?.some(i => i.type === "talent" && itemHasName(i, "Adrenaline Rush"));
}

/** Доступно ли прямо сейчас (раз за бой/сцену, тот же троттлинг, что Resplendent Raiment). */
export function adrenalineRushAvailable(actor) {
  return hasAdrenalineRush(actor) && isThrottleReady(actor, FLAG, resplendentUnit());
}

/**
 * Применяет эффект: тратит 1 Очко Бесчестия, восстанавливает Реакции
 * (универсальные + доп. пул на Избегание) до максимума и полностью сбрасывает
 * пул дистанции Отскока этого Раунда — одним update плюс resetRecoilPool.
 */
export async function applyAdrenalineRush(actor) {
  const fate = actor.system.fate?.value ?? 0;
  if (fate <= 0) return ui.notifications?.warn("Нет Очка Бесчестия — Прилив Адреналина не активирован.");

  await markThrottleUsed(actor, FLAG, resplendentUnit());

  const reactMax   = Number(actor.system.reactions?.max) || 0;
  const defenseMax = effectiveDefenseReactionMax(actor);
  await actor.update({
    "system.fate.value": fate - 1,
    "system.reactions.value": reactMax,
    "system.reactions.defenseValue": defenseMax
  });
  await resetRecoilPool(actor);

  await postTestCard(actor, {
    icon: rollIcon("run", "#4dffa6"), title: `Прилив Адреналина — ${esc(actor.name)}`,
    lines: [
      `<div class="roll-threshold">Реакции восстановлены до максимума (${reactMax}${defenseMax ? ` +${defenseMax}` : ""}).</div>`,
      `<div>Дистанция Отскока в этом Раунде восстановлена — потраченного как не бывало.</div>`
    ]
  }, { sound: false });
}

// module/rules/aiming.mjs
//
// Прицеливание (wdbc-1rno.5, core.json «БОЙ»): «Полу-прицеливание —
// Полудействие, Ментальное. Если следующее действие персонажа является
// Атакой (но не психосилой, техночудом или чудом веры), оно получает бонус
// +10. Если персонаж совершает несколько атак одним действием — только одна
// получает преимущества Прицеливания.» Полное Прицеливание — то же, Полное
// действие, бонус +20.
//
// Раньше actor.system.aiming менялся радиокнопкой прямо в диалоге атаки, без
// расхода ОД вовсе (баг, не «ещё не смоделировано» — см. bd wdbc-1rno.5).
// Здесь — само действие (цена, гейт бесплатности); бонус к порогу и его
// потребители (Sniper Assassin, hip-fire, Fanning) остаются в
// sheets/attack-dialog.mjs и читают actor.system.aiming как раньше, не зная,
// откуда оно взялось.
//
// Длительность (решение пользователя 16.09.2026): бонус доживает до первого
// из — Атаки этого актора (тратится, даёт бонус — attack/dialog.mjs:217),
// Движения/Уклонения/Парирования/получения урона/любого иного действия
// (тратится впустую, без бонуса). Реализовано в combat/action-economy.mjs
// (spendActionPoints/spendReaction — любой ненулевой расход считается
// «действием») и combat/damage.mjs (applyDamageToActor).

import { isBlackEyesItem } from "./black-eyes.mjs";
import { hasColdEyes } from "./cold-eyes.mjs";
import { blessingOfMagnusFreeHalfAim } from "./blessing-of-magnus.mjs";

/** Цена Полу-/Полного Прицеливания книгой, в ОД (без модификаторов). */
export const AIM_BASE_COST = { half: 1, full: 2 };

/**
 * Дар Слаанеш «Чёрные Глаза» (gift.slaanesh.blackEyes): «При Cor 80+ он
 * получает способность проводить Полу-Прицеливание как свободное действие,
 * если он видит цель.» seesTarget считает вызывающая сторона
 * (combat/aiming-action.mjs) — здесь только чистое условие.
 */
export function blackEyesFreeHalfAim(actor, { seesTarget = false } = {}) {
  if (!seesTarget) return false;
  const cor = Number(actor?.system?.corruption?.value) || 0;
  if (cor < 80) return false;
  return !!actor?.items?.some(i => isBlackEyesItem(i));
}

/**
 * Цена Прицеливания в ОД для этого актора: обычная Полудействие(1)/
 * Полное(2), либо 0 для Полу-Прицеливания при Cor 80+ Чёрных Глазах (если
 * персонаж видит цель), либо при активном Blessing of Magnus/Благословение
 * Магнуса с психосиловым оружием (rules/blessing-of-magnus.mjs, wdbc-1rno.5,
 * находка 10/12), либо Cold Eyes/Холодные Глаза (rules/cold-eyes.mjs,
 * находка 7/12): «может совершать Полу-Прицеливание за свободное действие и
 * Полное Прицеливание за полудействие» — снижает ОБЕ цены безусловно, не
 * только Полу-, и не требует видеть цель.
 */
export function aimApCost(actor, level, { seesTarget = false } = {}) {
  if (level === "half" && blackEyesFreeHalfAim(actor, { seesTarget })) return 0;
  if (level === "half" && blessingOfMagnusFreeHalfAim(actor)) return 0;
  if (hasColdEyes(actor)) return level === "full" ? 1 : 0;
  return AIM_BASE_COST[level] ?? 0;
}

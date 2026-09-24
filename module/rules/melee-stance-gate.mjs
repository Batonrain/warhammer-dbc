// module/rules/melee-stance-gate.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Доступность Стойки (стр. 15) вне диалога атаки — панель БОЙ
//  (character-context.mjs::combatStanceOptions, tabs/combat.mjs клик по
//  .technique-btn-stance). Та же логика (Тренировка/категория/Баланс/пешком),
//  что уже считает module/sheets/attack/selection.mjs::computeStanceOptions
//  для диалога атаки — вынесена сюда, чтобы не разойтись между двумя местами
//  (было ровно так: панель БОЙ показывала все Стойки без фильтра, диалог —
//  с фильтром, wdbc-x1nz.2.66-follow-up).
// ════════════════════════════════════════════════════════════════════════════

import { MELEE_STANCES } from "../constants/combat.mjs";
import { meleeTrainingStatus } from "./weapon-training.mjs";
import { equippedMeleeWeapon } from "../combat/equipped-melee.mjs";

/** Есть ли у персонажа доступ к этой Стойке прямо сейчас (без учёта уже выбранной). */
export function meleeStanceAllowed(actor, key) {
  const def = MELEE_STANCES[key];
  if (!def) return false;
  const meleeItem = equippedMeleeWeapon(actor);
  const category  = meleeItem?.system?.meleeCategory || "";
  const balance   = meleeItem?.system?.balance ?? 0;
  const trained   = meleeTrainingStatus(actor, category).trained;
  const altitude  = actor.system?.movement?.altitude;
  const isFlying  = altitude === "low" || altitude === "high";
  const isMounted = !!actor.system?.mount?.uuid;

  const trainingOk = trained || key === "standard";
  const groundedOk = key === "standard" || (!isMounted && !isFlying);
  const fitOk = def.categories
    ? (def.strictCategory ? (!!category && def.categories.includes(category))
                           : (!category || def.categories.includes(category)))
    : def.minBalance != null ? (balance >= def.minBalance)
    : true;
  return trainingOk && groundedOk && fitOk;
}

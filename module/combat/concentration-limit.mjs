// module/combat/concentration-limit.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Лимит Концентрации за Ход (стр. 12, wdbc-x1nz.2.33): «Концентрация –
//  действие требует особого внимания. Персонаж может совершать только одну
//  Концентрацию в свой Ход.»
//
//  Тот же приём, что Лимит Атак (combat/attack-limit.mjs) — отдельный
//  счётчик flags.warhammer-dbc.concentrationActionsThisTurn, сбрасывается
//  тем же тактом (TURN_SCOPED_FLAGS, action-economy.mjs::resetActionEconomy).
//
//  На момент ввода (wdbc-x1nz.2.33) ни один предмет пака не помечен как
//  действие типа «Концентрация» — книга вводит типы действий (стр. 12) как
//  общую классификацию раньше, чем в системе появляется расстановка тега
//  «это действие какого типа» на способностях (её нет вовсе ни у одной,
//  см. находки wdbc-x1nz.2.29-32 рядом). Здесь — только сам счётчик/лимит,
//  готовый к подключению: когда конкретная способность получит тег
//  «Концентрация», её код вызывает canTakeConcentrationAction/
//  takeConcentrationAction тем же образом, что диалог атаки — Лимит Атак.
// ════════════════════════════════════════════════════════════════════════════

import { isEncounterActive, hasActionEconomy } from "./action-economy.mjs";

const FLAG_SCOPE = "warhammer-dbc";
const FLAG_KEY = "concentrationActionsThisTurn";

/** Лимит Концентраций за Ход — всегда 1 (книга не описывает способов его поднять). */
export function concentrationActionLimit() {
  return 1;
}

/** Хватит ли лимита ещё на одну Концентрацию в этом Ходу — вне боя лимит не считается вовсе. */
export function canTakeConcentrationAction(actor) {
  if (!isEncounterActive() || !hasActionEconomy(actor)) return true;
  const used = Number(actor.getFlag(FLAG_SCOPE, FLAG_KEY)) || 0;
  return used < concentrationActionLimit();
}

/** Засчитать Концентрацию в счётчик Хода — вызывать РОВНО ОДИН раз на объявление. */
export async function takeConcentrationAction(actor) {
  if (!isEncounterActive() || !hasActionEconomy(actor)) return;
  const used = Number(actor.getFlag(FLAG_SCOPE, FLAG_KEY)) || 0;
  await actor.setFlag(FLAG_SCOPE, FLAG_KEY, used + 1);
}

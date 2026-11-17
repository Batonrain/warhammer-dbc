// module/rules/reliable-soldier.mjs
// Надёжный Вояка (Reliable Soldier) — dbc-114, 14.11.2026, чистая логика без Foundry.
//
//  «Выбирает по одному типу рукопашного и стрелкового оружия: +2 Dmg, +1 Pen, +1 надёжность.»
//  Типы: рукопашного — категория (meleeCategory: Меч, Топор…), стрелкового — тип (weaponType).
//  Выбор хранится флагами актора; +1 к надёжности автоматикой не считается (подсказка в окне выбора).

export const RELIABLE_SOLDIER_CAP = "weapon.reliableSoldier";
export const RELIABLE_MELEE_FLAG = "reliableMelee";
export const RELIABLE_RANGED_FLAG = "reliableRanged";
export const RELIABLE_DMG = 2;
export const RELIABLE_PEN = 1;

const norm = s => String(s ?? "").trim().toLowerCase();

/** Тип оружия, по которому считается выбор: категория рукопашного или тип стрелкового. */
export function reliableTypeOf(weapon, isMelee) {
  return isMelee ? String(weapon?.system?.meleeCategory ?? "").trim() : String(weapon?.system?.weaponType ?? "").trim();
}

/** Бонус к Dmg и Pen: у выбранного типа — +2/+1, иначе 0/0. */
export function reliableSoldierBonus({ chosenMelee, chosenRanged, weapon, isMelee }) {
  const chosen = isMelee ? chosenMelee : chosenRanged;
  const type = reliableTypeOf(weapon, isMelee);
  return chosen && type && norm(chosen) === norm(type) ? { dmg: RELIABLE_DMG, pen: RELIABLE_PEN } : { dmg: 0, pen: 0 };
}

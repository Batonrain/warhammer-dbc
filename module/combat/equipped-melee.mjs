// module/combat/equipped-melee.mjs
//
// «Первое надетое рукопашное» — общий выбор для парирования (defense.mjs),
// рук HUD (apps/hud.mjs) и категории Состязаний (sheets/character-context.mjs).
// Интегральные атаки (Кулак/Пинок/…, flags.warhammer-dbc.integralAttack)
// надеты ВСЕГДА — без фильтра они перехватывали бы выбор у настоящего оружия:
// кулак (Баланс −1) парировал бы с −10, пинок (Баланс −2) — «нельзя парировать»,
// а меч на поясе игнорировался. Интегральные берутся только фолбэком, когда
// другого надетого рукопашного нет.

const FLAG = "warhammer-dbc";

/** Интегральная атака (безоружный удар, выданный расой/Чертой)? */
export function isIntegralAttack(item) {
  return !!item?.getFlag?.(FLAG, "integralAttack");
}

/** Первое надетое рукопашное/метательное; интегральные — только как фолбэк. */
export function equippedMeleeWeapon(actor) {
  const melee = (actor?.items ?? []).filter(i =>
    i.type === "weapon" && i.system.equipped &&
    (i.system.weaponClass === "melee" || i.system.weaponClass === "thrown"));
  return melee.find(i => !isIntegralAttack(i)) ?? melee[0] ?? null;
}

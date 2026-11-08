const EXPENDABLE_TYPES = new Set(["grenade", "rocket"]);
const NON_RELOADABLE = /^\s*Не перезаряжается/u;

export function hasNoMagazine(item) {
  return !((Number(item?.system?.magazineMax) || 0) > 0);
}

export function isExpendableOrdnance(item) {
  const sys = item?.system;
  if (!sys) return false;
  if (EXPENDABLE_TYPES.has(sys.weaponType)) return true;
  return sys.weaponType === "launcher" && NON_RELOADABLE.test(String(sys.special ?? ""));
}

export function tracksMagazine(item) {
  return !hasNoMagazine(item) && !isExpendableOrdnance(item);
}

// module/rules/ammo-override.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Снаряды орудий техники (wdbc-nzzgn) — два правила, вынесенные из боя и листа.
//
//  1. ПОДБОР. Боеприпас с weaponTag подходит только орудию с тем же именем
//     (английская часть «Английское / Русское», без регистра): «Phosphex
//     Shell» — снаряд Осадной Пушки Медузы, а не любой Боевой Пушки. Пустой
//     тег — прежнее правило по типу/классу оружия. Тип проверяется всегда:
//     тег сужает выбор, но не обходит несовместимость.
//
//  2. ЗАМЕНА. Боеприпас персонажа правит профиль оружия (+N к Dmg/Pen), у
//     снаряда машины в книге свои абсолютные Dmg/Pen/Rng — они ЗАМЕНЯЮТ базу
//     орудия: damageOverride / penetrationOverride / rangeOverride. Пустое
//     значение — «не задано» (Пробитие null; Дальность 0), поэтому Пробитие 0
//     — настоящее значение. «–» или «0» в уроне — снаряд без урона (дымовой,
//     осветительный): формула пуста, и бой не бросает кубы.
//
//  Общий для боя (combat/attack.mjs, окна атаки) и листов (reload.mjs,
//  sheet-helpers.mjs, vehicle-sheet.mjs), чтобы правило не жило в трёх копиях.
// ════════════════════════════════════════════════════════════════════════════

/** Тег орудия — его имя: английская часть до « / », нижний регистр. */
export function weaponAmmoTagOf(weapon) {
  const name = String(weapon?.name ?? "").split("/")[0];
  return name.trim().toLowerCase();
}

/** Подходит ли боеприпас оружию. sysOverride — system ствола комби-оружия (профиль). */
export function ammoFitsWeapon(ammo, weapon, sysOverride = null) {
  if (ammo?.type !== "ammo") return false;
  const sys    = sysOverride ?? weapon?.system ?? {};
  const aTypes = ammo.system?.weaponTypes || [];
  const typeOk = aTypes.includes(sys.weaponType) || aTypes.includes(sys.weaponClass) || aTypes.includes("any");
  if (!typeOk) return false;
  const tag = String(ammo.system?.weaponTag ?? "").trim().toLowerCase();
  return !tag || tag === weaponAmmoTagOf(weapon);
}

const NO_DAMAGE = /^\s*(?:[–—-]|0)\s*$/;

/** Абсолютные значения снаряда; null — не задано, базу орудия не трогаем. */
export function ammoOverrides(ammoSys) {
  const rawDmg = String(ammoSys?.damageOverride ?? "").trim();
  const pen    = ammoSys?.penetrationOverride;
  const rng    = Number(ammoSys?.rangeOverride) || 0;
  return {
    damage:      !rawDmg ? null : NO_DAMAGE.test(rawDmg) ? "" : rawDmg,
    penetration: (pen === null || pen === undefined || pen === "") ? null : Number(pen),
    range:       rng > 0 ? rng : null
  };
}

/** Дальность с боеприпасом: override заменяет, иначе база × множитель + прибавка. */
export function effectiveAmmoRange(baseRange, ammoSys) {
  const o = ammoOverrides(ammoSys);
  if (o.range !== null) return o.range;
  const mult = ammoSys?.rangeMultiplier ?? 1;
  const add  = ammoSys?.rangeMod ?? 0;
  return Math.round((Number(baseRange) || 0) * mult) + add;
}

/**
 * Свойства базового профиля орудия, которых у снаряда техники НЕТ: снаряд (weaponTag)
 * заменяет профиль целиком, а не добавляет к нему, поэтому Blast (8) Боевой Пушки
 * не должен пережить Дымовой Снаряд. Обычный боеприпас (без тега) ничего не снимает.
 * @param {object} ammoSys   system боеприпаса
 * @param {Array}  baseProps system.weaponProps орудия (строки или { key })
 * @returns {string[]} ключи свойств, которые снаряд убирает
 */
export function shellDroppedProps(ammoSys, baseProps) {
  if (!String(ammoSys?.weaponTag ?? "").trim()) return [];
  const own = new Set((ammoSys.properties || []).map(p => typeof p === "string" ? p : p?.key).filter(Boolean));
  return (baseProps || []).map(p => typeof p === "string" ? p : p?.key)
    .filter(k => k && !own.has(k) && !SHELL_KEEPS.has(k));
}

/**
 * Свойства самого орудия, а не профиля: снаряд их не снимает (решение владельца 13.11.2026 —
 * Twin-Linked сдвоенного орудия работает и с бронебойным снарядом).
 */
const SHELL_KEEPS = new Set(["twinLinked"]);

// module/rules/legionnaire-virtuoso.mjs
//
// Legionnaire Virtuoso / Легионер-Виртуоз — Черта архетипа Искатель
// (Космодесант, корбук, «Архетипы Космодесантников», стр. 15):
//
//   «Все стрелковое оружие легиона в руках Искателя получает дополнительный
//   кубик на урон и отбрасывает один с наименьшим результатом, даже на
//   альтернативных профилях (прикладом, штыком, и т.п.)»
//
// «Оружие легиона» — свойство Legion (constants/weapon-properties.mjs; в
// книге — приставка «L.»). «Стрелковое» — любой класс, кроме рукопашного.
// Проверяется САМО оружие, а не выбранный профиль: удар прикладом/штыком —
// профиль того же стрелкового оружия, книга прямо включает его.
//
// Механизм — тот же, что у Рвущего (Tearing): +1 кубик, оставить исходное
// число наибольших. Складывается с Рвущим [допущение: у болтеров Легиона
// Tearing уже есть; иначе Черта не давала бы им ничего — книга такого
// исключения не пишет]: 1d10 → 3d10kh1. Читатель — combat/attack.mjs
// (wp.extraDropLowest) → combat/weapon-properties.mjs::applyDamageDiceMods.

/** Имя возможности (module/constants/capabilities.mjs), выдаёт документ Черты. */
export const LEGIONNAIRE_VIRTUOSO = "trait.legionnaireVirtuoso";

/**
 * Стрелковое оружие легиона: не рукопашное и со свойством Legion.
 * @param {object} weaponSys  system оружия (НЕ профиля)
 */
export function isLegionRangedWeapon(weaponSys) {
  if (!weaponSys || weaponSys.weaponClass === "melee") return false;
  return (weaponSys.weaponProps ?? []).some(p => (p?.key ?? p) === "legion");
}

// module/rules/quiet-elimination.mjs
//
// Quiet Elimination / Тихое Устранение (Аэльдари, wdbc-1rno.3,
// packs-src/books/aeldari-branches.json — полный текст, capability
// trait.quietElimination короче): «Убийцы действуют быстро и молниеносно.
// Если персонаж атакует противника врасплох, то он наносит на +1 кубик
// урона больше, а цель не издаёт звука при гибели. Если персонаж
// использует только ножи или игольчатые/осколочные пистолеты, он получает
// +10 к тестам атаки.»
//
// Два НЕЗАВИСИМЫХ пункта, не один: +1 куб/тихая смерть завязаны на
// per-attack галочку «Цель Врасплох» (стр. 32, любое оружие) — combat/
// attack.mjs::targetSurprised. +10 к атаке завязан на КОНКРЕТНОЕ оружие
// (нож/игольчатый/осколочный пистолет), независимо от Врасплох — читается
// здесь же, но подключается в sheets/attack/mods.mjs как situational-мод.
// «Цель не издаёт звука при гибели» — не гейтится ничем машиночитаемым
// (нет общего детектора смерти-от-этого-попадания раньше формулы урона в
// этот момент пайплайна) — честно только строка в карточке.

import { itemHasName } from "./predicates.mjs";
import { isKnifeWeapon } from "./unseen-talents.mjs";
import { isSplinter } from "../constants/drukhari-splinter.mjs";

export function hasQuietElimination(actor) {
  return (actor?.items ?? []).some(item => (item?.type === "trait" || item?.type === "talent") &&
    (itemHasName(item, "Quiet Elimination") || itemHasName(item, "Тихое Устранение")));
}

/**
 * Нож ИЛИ игольчатый/осколочный пистолет. Осколочное — структурный признак
 * (weaponType "splinter", drukhari-splinter.mjs::isSplinter). Игольчатое
 * такого единого признака в данных не несёт (разные записи компендиума
 * используют weaponType "exotic" ИЛИ "needler" в зависимости от фракции/
 * происхождения, проверено разведкой по packs-src/weapons) — здесь имя
 * предмета, тот же уровень честности, что у категорийных проверок в
 * остальной системе, где структурного поля нет.
 */
export function isQuietEliminationWeapon(item) {
  if (isKnifeWeapon(item)) return true;
  const sys = item?.system;
  if (sys?.weaponClass !== "pistol") return false;
  if (isSplinter(sys)) return true;
  return /needl|игольн|иглопистолет|игловик/i.test(String(item?.name || ""));
}

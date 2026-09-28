// module/rules/runt.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Runt / Коротышка — Черта Ратлинга (Основная книга, глава I «Расы»):
//
//    «Ратлинг получает –4 к максимуму Ран. Хотя он ощутимо меньше людей, его
//    ладони достаточно близки по размеру к человеческим. Ратлинг может
//    использовать оружие для персонажей Размером 0, но считает все винтовки
//    длинными винтовками, и не может использовать двуручное стрелковое оружие
//    одной рукой, невзирая на его модификации. Модификация Compact нивелирует
//    эти штрафы (оружие, специально созданные под Ратлингов, считается уже
//    имеющим эту модификацию).»
//
//  Четыре части и где каждая живёт:
//
//  1. −4 к максимуму Ран — ПРОИЗВОДНЫЙ максимум (system.wounds.effectiveMax,
//     rules/character.mjs), тот же канал, что −5 Саркофага Дредноута. Не
//     разовая запись Конструктора kind:"wounds": раса выдаётся на Этапе 1
//     Мастера создания, когда максимум Ран ещё 0 — вычитание упиралось в
//     ноль и пропадало, а Раны Архетипа бросались потом поверх. Производное
//     значение не зависит от порядка выдачи и уходит вместе с Чертой.
//  2. «Все винтовки — длинные» — свойство оружия longRifle (constants/
//     weapon-properties.mjs: нельзя стрелять в рукопашной) доливается в
//     getModEffects (combat/weapon-mods.mjs) — тем же путём, что Fully Armed,
//     поэтому его видят все шесть мест, где считаются свойства оружия.
//  3. «Двуручное стрелковое нельзя одной рукой, невзирая на модификации» —
//     из хватов убирается «1р» и в окне атаки (sheets/attack-dialog.mjs), и
//     в бюджете рук (rules/hands.mjs): эти два списка обязаны совпадать.
//  4. «Оружие Размера 0» — ограничения оружия по Размеру носителя (меньше 0)
//     в системе нет вовсе, запрещать нечего; оружие Легиона считает «Размер
//     меньше 1» одинаково для −1 и 0 (rules/legion-fit.mjs).
//
//  Compact — установленная модификация оружия «Compact / Компактное»
//  (packs-src/weapon-mods). Оружие «под Ратлингов» в паках не заведено ни
//  одного; такое ГМ выдаёт вместе с поставленной модификацией.
//
//  Кто Коротышка — по имени Черты ИЛИ по ключу Возможности trait.runt
//  (rules/ability-by-key.mjs::hasAbility): Черта в паке несёт запись
//  Конструктора kind:"capability", имя проверяется первым как дешёвое.
// ════════════════════════════════════════════════════════════════════════════

import { hasAbility } from "./ability-by-key.mjs";
import { itemHasName } from "./predicates.mjs";
import { parseGrips } from "../constants/combat.mjs";

export const RUNT_CAPABILITY = "trait.runt";
export const RUNT_TRAIT_NAME = "Runt";
/** «Ратлинг получает –4 к максимуму Ран». */
export const RUNT_WOUNDS_MAX = -4;

const COMPACT_MOD_NAME = "Compact";
// Стрелковые классы, у которых бывает «двуручный» хват (стр. 171).
const RANGED_CLASSES = new Set(["pistol", "basic", "heavy", "launcher"]);
// Природный хват класса, когда у предмета своего sys.grips нет — тот же, что
// берёт окно атаки (attack-dialog.mjs, classDefaultGrip).
const TWO_HANDED_BY_CLASS = new Set(["basic", "heavy", "launcher"]);

/** Есть ли у актора Черта «Коротышка» (по имени или по возможности). */
export function isRunt(actor) {
  return hasAbility(actor, RUNT_CAPABILITY, RUNT_TRAIT_NAME, "trait");
}

/** Установлена ли на этом оружии модификация Compact. */
export function hasCompactMod(actor, weapon) {
  if (!actor?.items || !weapon?.id) return false;
  return actor.items.some(i =>
    i?.type === "weaponMod" && i.system?.installedOn === weapon.id && itemHasName(i, COMPACT_MOD_NAME));
}

function isWeapon(weapon) {
  return weapon?.type === "weapon";
}

/** Основной хват стрелкового — двуручный. */
function isTwoHandedRanged(weapon) {
  const sys = weapon?.system || {};
  if (!RANGED_CLASSES.has(sys.weaponClass)) return false;
  const own = parseGrips(sys.grips);
  return own.length ? own[0] === "2р" : TWO_HANDED_BY_CLASS.has(sys.weaponClass);
}

/**
 * «Считает все винтовки длинными винтовками». Винтовка и длинная винтовка —
 * один класс «basic» (стр. 171); длинную отличает свойство longRifle.
 */
export function runtRifleIsLong(actor, weapon, runt = isRunt(actor)) {
  if (!runt || !isWeapon(weapon) || weapon.system?.weaponClass !== "basic") return false;
  return !hasCompactMod(actor, weapon);
}

/** «Не может использовать двуручное стрелковое оружие одной рукой». */
export function runtForbidsOneHand(actor, weapon, runt = isRunt(actor)) {
  if (!runt || !isWeapon(weapon) || !isTwoHandedRanged(weapon)) return false;
  return !hasCompactMod(actor, weapon);
}

/**
 * Поправки к максимуму Ран от Коротышки — список {label, value} для строки
 * «с учётом Черт» в блоке РАНЫ (rules/character.mjs складывает его с
 * Саркофагом Дредноута).
 */
export function woundsMaxMods(actor) {
  return isRunt(actor) ? [{ label: "Коротышка", value: RUNT_WOUNDS_MAX }] : [];
}

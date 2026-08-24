// module/rules/weapon-training.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Таланты «Арсенал» (стр. 62): Melee Training/Weapon Training/Exotic Weapon
//  Training. Специализация сегодня НЕ проходит через реестр способностей
//  (hasRuleFlag/kind:"capability") — тот даёт только ФИКСИРОВАННОЕ имя на
//  запись Конструктора, а тут одна и та же покупка Таланта может дать любую
//  из 10-13 специализаций. Поэтому читаем напрямую: у купленного Таланта
//  специализация лежит в system.specialization (module/sheets/item-picker.mjs
//  резолвит её при покупке в диалоге выбора).
//
//  Блочные обходы (Legion/Eldar/Kabalite Weapon Training, Arms Master) —
//  ФИКСИРОВАННЫЕ способности («считается имеющим ВСЕ специализации»), для них
//  reестр способностей подходит как есть — см. module/constants/capabilities.mjs.
//
//  Приём по духу: module/rules/legion-fit.mjs (legionAttackPenalty) — тот же
//  паттерн «штраф за не то оружие», уже подключённый в attack-dialog.mjs.
// ════════════════════════════════════════════════════════════════════════════

import { hasRuleFlag } from "./flags.mjs";
import { MELEE_TRAINING_EXEMPT, WEAPON_TYPE_TO_TRAINING, sameCategory } from "../constants/weapon-categories.mjs";

const MELEE_TRAINING_NAME  = /^Melee Training\b/i;
const WEAPON_TRAINING_NAME = /^Weapon Training\b/i;

/** Специализации купленных Талантов с этим именем (через запятую — на случай непорезолвленного шаблона). */
function ownedSpecs(actor, nameRe) {
  return (actor?.items ?? [])
    .filter(i => i.type === "talent" && nameRe.test(i.name || ""))
    .flatMap(i => String(i.system?.specialization || "").split(",").map(s => s.trim()).filter(Boolean));
}

// allRanged зеркалит allMelee (Arms Master) — та же «считается имеющим все
// специализации», только для Weapon Training, а не Melee Training (Оракул
// Стали, Дар Кхорна: «владение всеми видами оружия»). «Настоящую» экзотику
// (weaponType:"exotic") это не покрывает — она системой вообще не
// проверяется, см. шапку файла.
const BLANKET_MELEE_FLAGS = ["weapon.trained.legion", "weapon.trained.eldar",
                              "weapon.trained.drukhari", "weapon.trained.allMelee"];
const BLANKET_RANGED_FLAGS = ["weapon.trained.legion", "weapon.trained.eldar",
                               "weapon.trained.drukhari", "weapon.trained.allRanged"];

/**
 * Владеет ли персонаж категорией рукопашного оружия (Melee Training, стр. 62).
 * Без владения книга не штрафует числом — ограничивает выбор Приёма/Стойки/
 * Хвата Обычной Атакой/Стандартной/Базовым (см. attack-dialog.mjs — только
 * предупреждение, не запрет, см. план «Таланты Арсенал»).
 */
export function meleeTrainingStatus(actor, category) {
  if (!category || MELEE_TRAINING_EXEMPT.includes(category)) return { trained: true, source: "exempt" };
  for (const flag of BLANKET_MELEE_FLAGS) if (hasRuleFlag(actor, flag)) return { trained: true, source: flag };
  const specs = ownedSpecs(actor, MELEE_TRAINING_NAME);
  if (specs.some(s => sameCategory(s, category))) return { trained: true, source: "talent" };
  return { trained: false, source: "" };
}

/**
 * Штраф −20 WS/BS за оружие без Weapon Training (стр. 62). Только категории с
 * надёжным соответствием system.weaponType (WEAPON_TYPE_TO_TRAINING) — Grav
 * теперь свой weaponType:"grav" и проверяется наравне с остальными;
 * «настоящие» экзотические предметы (weaponType:"exotic") по-прежнему не
 * проверяются (нет доп. данных, см. план «Таланты Арсенал»). Primary (=Primitive, включает Bow) считается
 * ТОЛЬКО для дальнобойного — рукопашные lowtech-шаблоны (Меч/Топор/Булава и
 * т.п.) идут через Melee Training по форме оружия, а не через эту функцию,
 * иначе обычный меч требовал бы разом двух разных Талантов.
 */
export function weaponTrainingPenalty({ actor, weaponType, weaponClass, isGrenade = false } = {}) {
  if (isGrenade) return { total: 0, parts: [] };
  const category = WEAPON_TYPE_TO_TRAINING[String(weaponType || "").toLowerCase()];
  if (!category) return { total: 0, parts: [] };
  if (category === "Primary" && weaponClass === "melee") return { total: 0, parts: [] };
  for (const flag of BLANKET_RANGED_FLAGS) if (hasRuleFlag(actor, flag)) return { total: 0, parts: [] };
  const specs = ownedSpecs(actor, WEAPON_TRAINING_NAME);
  if (specs.some(s => sameCategory(s, category))) return { total: 0, parts: [] };
  return { total: -20, parts: [{ label: `Не владеет оружием (${category})`, value: -20 }] };
}

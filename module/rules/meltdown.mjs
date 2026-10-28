// module/rules/meltdown.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Meltdown / Расплавление (core.json, «Оружейник», Sahara 3-9d40, решение владельца
//  24.10.2026 — полностью, с таймером взрыва).
//
//  Книга: «Имея в руках лаз-оружие с улучшением Power Setting, и металлический нож в
//  руках или на разгрузке, за полудействие персонаж может пройти тест Tech-Use+10 – при
//  Провале он ломает оружие и то бесполезно, пока его не починят (что занимает смену
//  работы), при Успехе оружие через 1d5 Раундов (в начале Хода персонажа) взрывается
//  шаблоном 3d10+10 Dmg, Pen 14, Blast(3), уничтожая батарею, само оружие, и нож. На 1-4
//  Успеха ГМ бросает 1d5 на время до взрыва втайне от игрока, а на 5+ – игрок бросает сам.
//  При Критическом Провале оружие взрывается немедленно в руках персонажа. Плавящееся от
//  перегрузки оружие … позволяет налепливать его на магнитные поверхности, как гранату».
//
//  Чего система не считает: «налепить на магнитную поверхность» — оружие остаётся у
//  персонажа, а шаблон взрыва размещают кнопкой там, где оно лежит (решает стол).
//  Неизвестные книге значения: тип урона взрыва не назван — берём Взрывной (X).
//
//  Чистые функции без Foundry. Отложенный взрыв — rules/delayed-blast.mjs, поток —
//  combat/meltdown.mjs. Не импортируется из rules/sources.mjs.
// ════════════════════════════════════════════════════════════════════════════

import { hasAbility } from "./ability-by-key.mjs";
import { hasPowerSetting } from "./power-setting.mjs";
import { isLasWeapon } from "./batpack-dump.mjs";

export const MELTDOWN = Object.freeze({ key: "weaponsmith.core.meltdown", name: "Meltdown" });
export const hasMeltdown = actor => hasAbility(actor, MELTDOWN.key, MELTDOWN.name, "talent");

/** Модификатор теста Tech-Use. */
export const MELTDOWN_TEST_MOD = 10;
/** Взрыв: 3d10+10 Dmg, Pen 14, Blast(3), Взрывной. */
export const MELTDOWN_BLAST = Object.freeze({ damage: "3d10+10", pen: 14, blast: 3, damageType: "blast", damageSubtype: "" });
/** Время до взрыва. */
export const MELTDOWN_TIMER_DIE = "1d5";
/** С такого числа Успехов время бросает игрок, а не ГМ. */
export const MELTDOWN_PLAYER_ROLLS_FROM = 5;

/** Лаз-оружие в руках с Power Setting, не сломанное. */
export const meltdownWeaponOk = (item, activeMods = []) => item?.type === "weapon"
  && !!item.system?.equipped && !item.system?.destroyed && isLasWeapon(item) && hasPowerSetting(item, activeMods);

/** Нож: рукопашное оружие категории «Нож» («Knife»), не сломанное, не на складе — «в руках или на разгрузке». */
export const meltdownKnifeOk = item => item?.type === "weapon"
  && item.system?.weaponClass === "melee" && item.system?.meleeCategory === "Нож"
  && !item.system?.destroyed && !item.system?.stored;

/**
 * Исход теста.
 *  critFail → "instant"  (Критический Провал — взрыв сразу, в руках);
 *  !success → "break"    (оружие сломано до починки);
 *  deg 1–4  → "hidden"   (срок бросает ГМ втайне);
 *  deg 5+   → "open"     (срок бросает игрок).
 */
export function meltdownOutcome({ success, deg = 0, critFail = false }) {
  if (critFail) return "instant";
  if (!success) return "break";
  return (Number(deg) || 0) >= MELTDOWN_PLAYER_ROLLS_FROM ? "open" : "hidden";
}

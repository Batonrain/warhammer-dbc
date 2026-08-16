// module/rules/horde-convert.mjs
//
// Превращение существа в Орду: тот же боец, но толпой. Считалка здесь чистая —
// на вход система актора, на выход система Орды; создание документа и копия
// предметов живут в apps/horde-convert.mjs.
//
// Что переносится и почему:
//   • Характеристики — ИТОГОВЫМИ значениями в «Базу». У Орды в записи только
//     база и продвижение, а у существа итог собран из базы, продвижений,
//     Сверхъестественного и надбавок эффектов. Перенеси мы одну базу — Астартес
//     потерял бы Unnatural Strength и бил бы вдвое слабее оригинала.
//   • Навыки — рангом: значение Орда пересчитает сама от своей характеристики.
//   • Раны → Магнитуда: максимум Ран становится стартовой Магнитудой, текущие —
//     текущей. Это и есть «вместо Ран у Орды Магнитуда» (стр. 106).
//   • Поглощение — готовое число по торсу (AP брони + бонус Стойкости): все
//     попадания по Орде идут в торс, зон у неё нет.
//   • Размер существа — в sizeMod: он нужен Орде для SPD, а боевой Размер она
//     считает от Магнитуды сама.

import { SKILLS_DEF, GROUP_SKILLS_DEF } from "../constants/skills.mjs";
import { CHARACTERISTICS } from "../constants/characteristics.mjs";

/** Типы предметов, которые переезжают в Орду: снаряжение и то, что делает бойца бойцом. */
export const HORDE_KEPT_ITEM_TYPES = [
  "weapon", "weaponMod", "ammo", "armor", "armorMod", "forcefield",
  "gear", "drug", "tool", "cybernetic", "implant",
  "talent", "trait", "mutation"
];

/** Названия Черты «Бесстрашный» — Орда с ней не ломается (стр. 107). */
const FEARLESS = /^(fearless|бесстрашн)/i;

const num = v => Number(v) || 0;

/**
 * Система Орды по системе существа.
 *
 * @param {object} system      actor.system существа
 * @param {object[]} items     его предметы (нужны только имена и типы Черт)
 * @param {object} [meta]      подписи: вид существа и краткое описание
 */
export function hordeSystemFrom(system = {}, items = [], meta = {}) {
  const chars = {};
  for (const key of Object.keys(CHARACTERISTICS)) {
    // Влияния у Орды нет — её схема этой характеристики не знает.
    if (key === "inf") continue;
    const c = system.characteristics?.[key] || {};
    const total = num(c.total);
    chars[key] = { base: total, advance: 0, total, bonus: Math.floor(total / 10) };
  }

  const skills = {};
  for (const key of Object.keys(SKILLS_DEF)) {
    skills[key] = { rank: system.skills?.[key]?.rank || "untrained", total: -20 };
  }

  // Групповые — записями со специализацией: «Управление (Наземный транспорт)»
  // толпе нужно ровно так же, как одиночке. Цена и «выдано архетипом» с собой
  // не едут: покупок за опыт у Орды нет.
  const groupSkills = {};
  for (const key of Object.keys(GROUP_SKILLS_DEF)) {
    const entries = system.groupSkills?.[key];
    groupSkills[key] = Array.isArray(entries)
      ? entries.filter(e => e?.specialty).map(e => ({
          specialty: e.specialty,
          rank:      e.rank || "untrained",
          ...(e.char ? { char: e.char } : {}),
          total:     -20
        }))
      : [];
  }

  // Текущие Раны становятся текущей Магнитудой, максимум — стартовой. Если
  // текущих нет вовсе (бестиарный лист, где заполнен только максимум), Орда
  // выходит в полном составе, а не сломленной.
  const start = Math.max(0, num(system.wounds?.max));
  const raw   = system.wounds?.value;
  const value = (raw === undefined || raw === null || raw === "")
    ? start
    : Math.min(start, Math.max(0, num(raw)));

  const fearless = items.some(i => (i.type === "talent" || i.type === "trait") && FEARLESS.test(i.name || ""));

  return {
    speciesName: meta.speciesName || "",
    faction:     meta.faction || "",
    descriptor:  meta.descriptor || "",
    characteristics: chars,
    skills,
    groupSkills,
    magnitude:   { value, start },
    psychDamage: 0,
    // Поглощение Орды — одно число: броня торса вместе с бонусом Стойкости.
    absorption:  Math.max(0, num(system.absorption?.body)),
    sizeMod:     num(system.size),
    enemiesInMelee: 0,
    immuneFear:  fearless,
    traits:      "",
    notes:       system.notes || "",
    gmNotes:     ""
  };
}

/** Имя дубля: оригинал остаётся на месте, Орда — отдельный актор. */
export function hordeNameFrom(name) {
  return `${String(name || "Существо").trim()} — Орда`;
}

/** Предметы, которые переносим: снаряжение, Таланты, Черты. */
export function hordeItemsFrom(items = []) {
  return items.filter(i => HORDE_KEPT_ITEM_TYPES.includes(i.type));
}

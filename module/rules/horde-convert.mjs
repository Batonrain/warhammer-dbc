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

/**
 * Обратное превращение: система Персонажа/Демона по системе Орды.
 *
 * Настоящего отката нет — прямое превращение уже необратимо теряет разбивку
 * характеристик (База/Продвижение/Сверхъестественное слиты в одно Итого),
 * цену навыков в опыте, метки «выдано архетипом», Расу/Архетип как ключи (у
 * Орды это готовые подписи, а не ключи) и Броню по зонам (Поглощение Орды —
 * одно число, уже включающее бонус Стойкости, — записать его прямо в Броню
 * значило бы задвоить Стойкость). Всё это НЕ восстанавливается — только
 * то, что Орда хранит без потерь: Раны (из Магнитуды), Ранг навыков,
 * Групповые навыки, Размер, снаряжение/Таланты/Черты-предметы. Остальное —
 * подписями в Заметки, чтобы ГМ не потерял информацию, а руками расставил.
 *
 * @param {object} system  actor.system Орды
 * @returns {object}       system нового Персонажа/Демона (без race/archetype —
 *                          те остаются пустыми, см. заметки)
 */
export function actorSystemFromHorde(system = {}) {
  const chars = {};
  for (const key of Object.keys(CHARACTERISTICS)) {
    if (key === "inf") continue; // у Орды не было — оставляем 0, ГМ поставит сам
    const c = system.characteristics?.[key] || {};
    const total = num(c.total);
    chars[key] = { base: total, advance: 0, supernatural: 0, total, bonus: num(c.bonus), cost: 0 };
  }

  const skills = {};
  for (const key of Object.keys(SKILLS_DEF)) {
    skills[key] = { rank: system.skills?.[key]?.rank || "untrained", cost: 0 };
  }

  const groupSkills = {};
  for (const key of Object.keys(GROUP_SKILLS_DEF)) {
    const entries = system.groupSkills?.[key];
    groupSkills[key] = Array.isArray(entries)
      ? entries.map(e => ({ specialty: e.specialty || "", rank: e.rank || "untrained", cost: 0 }))
      : [];
  }

  // Магнитуда → Раны: обратное «раны становятся Магнитудой» из hordeSystemFrom.
  const max   = Math.max(0, num(system.magnitude?.start));
  const value = Math.min(max, Math.max(0, num(system.magnitude?.value)));

  // То, что структурно не восстановить, — читаемой справкой в Заметки, а не
  // молча теряется. Раса/Архетип/Черты(текст)/Фракция Орды — готовые подписи
  // или строка не той формы (Фракция у Персонажа/Демона — предметы-Фракции,
  // а не system.faction: у creatureSchema такого поля нет вовсе, запись туда
  // Foundry молча отбросила бы при валидации), поэтому в структурные поля
  // не идут — только текстом.
  const noteLines = [];
  if (system.speciesName) noteLines.push(`Вид (из Орды): ${system.speciesName}`);
  if (system.faction)     noteLines.push(`Фракция (из Орды): ${system.faction}`);
  if (system.descriptor)  noteLines.push(`Архетип/особенность (из Орды): ${system.descriptor}`);
  if (system.traits)      noteLines.push(`Черты (текст, из Орды): ${system.traits}`);
  if (system.notes)       noteLines.push(system.notes);
  const notesHtml = noteLines.map(l => `<p>${l}</p>`).join("");

  return {
    wounds: { value, max },
    characteristics: chars,
    skills,
    groupSkills,
    size: num(system.sizeMod),
    notes: notesHtml
  };
}

/** Имя нового Персонажа/Демона из имени Орды — снимает суффикс « — Орда», если он есть. */
export function actorNameFromHorde(name) {
  const base = String(name || "Существо").trim().replace(/\s*—\s*Орда\s*$/i, "");
  return base || "Существо";
}

/** Предметы, которые переносим: снаряжение, Таланты, Черты. */
export function hordeItemsFrom(items = []) {
  return items.filter(i => HORDE_KEPT_ITEM_TYPES.includes(i.type));
}

// module/sheets/tabs/rituals.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Поля пути проведения на листе предмета-ритуала (корбук стр. 393-425).
//  Список ритуалов на листе актора убран — дублировал консоль Завесы
//  (module/apps/veil.mjs, вкладка «Ритуалы»), которая уже читает предметы
//  типа ritual с актора-Ритуалиста напрямую.
// ════════════════════════════════════════════════════════════════════════════

import { TEST_CHARS } from "../../constants/rituals.mjs";
import { SKILLS_DEF, GROUP_SKILLS_DEF } from "../../constants/skills.mjs";

/**
 * Поля пути проведения для листа предмета-ритуала: каким Навыком и от какой
 * характеристики он кидается. Набор навыков зависит от вида — обычные и
 * групповые не смешиваются, иначе в `testSkillKey` попал бы ключ, которого у
 * актора не бывает, и подстановка в консоли Завесы молча промахнулась бы.
 */
export function ritualTestContext(item) {
  const s = item?.system || {};
  const isGroupSkill = s.testSkillScope === "group";
  const defs = isGroupSkill ? GROUP_SKILLS_DEF : SKILLS_DEF;
  return {
    isGroupSkill,
    skills: Object.entries(defs)
      .map(([key, def]) => ({ key, label: def.label, selected: key === s.testSkillKey })),
    chars: TEST_CHARS.map(c => ({ ...c, selected: c.key === (s.testChar || "int") }))
  };
}

// module/constants/training.mjs
// Данные и выборки UI для «Обучения» (книга, стр. 22) — курс в Мастерской
// Крафта (module/apps/craft-workshop.mjs, mode:"training").

import { SKILLS_DEF, GROUP_SKILLS_DEF } from "./skills.mjs";
import { findGroupEntry } from "./skill-specializations.mjs";
import { SKILL_RANKS } from "./characteristics.mjs";
import { hasKlaivexTalent } from "../rules/training-advantage.mjs";

/** Элитный архетип, на скидку к которому ведёт курс Клэйвекса (книга, стр. 22). */
export const KLAIVEX_DISCOUNT_ARCHETYPE = "Incubus / Инкуб";

export const TRAINING_SESSIONS_PER_COURSE = 8;

// ── Комбинированный тест учителя (Charm/Logic/Intimidate поверх Trade(Instructor)) ──
export const TRAINING_SOCIAL_OPTIONS = [
  { key: "charm",      label: "Charm (F)+0",       char: "fel", mod: 0 },
  { key: "logic",      label: "Logic (I)−10",      char: "int", mod: -10 },
  { key: "intimidate", label: "Intimidate (W)+0",  char: "wp",  mod: 0 }
];

const untr = (actor, charKey) => (actor?.system?.characteristics?.[charKey]?.total ?? 0) - 20;
const rankBonusOf = r => SKILL_RANKS[r ?? "untrained"]?.bonus ?? -20;

/**
 * Опция соц. Навыка учителя (combined-тест, training.mjs::teacherCombinedLimit
 * читает только rankBonus+mod — ведущим в этом combined-тесте всегда Trade
 * (Instructor), социальный Навык вносит синергию рангом, как у Крафта).
 */
export function socialSkillOption(teacher, socialKey) {
  const def = TRAINING_SOCIAL_OPTIONS.find(o => o.key === socialKey);
  if (!def) return null;
  const sk = teacher?.system?.skills?.[socialKey];
  return { rankBonus: rankBonusOf(sk?.rank), mod: def.mod, label: def.label };
}

/** Trade(Instructor) учителя: total записи специализации, иначе — необученная Int. */
export function instructorOption(teacher) {
  const entry = findGroupEntry(teacher, "trade", "Instructor");
  const total = entry?.total ?? untr(teacher, "int");
  return { total, found: !!entry };
}

/**
 * Чему учитель МОЖЕТ учить — только то, что знает сам (ранг/Талант на листе),
 * «не выше своего уровня» выполняется само собой (список = его текущий ранг).
 */
export function buildTeachableTargets(teacher) {
  const out = [];
  const skills = teacher?.system?.skills || {};
  for (const [key, def] of Object.entries(SKILLS_DEF)) {
    const s = skills[key];
    if (s?.rank && s.rank !== "untrained")
      out.push({ value: `skill:${key}`, label: def.label, kind: "skill", key, rankLabel: s.rank });
  }
  for (const [gkey, gdef] of Object.entries(GROUP_SKILLS_DEF)) {
    const entries = Array.isArray(teacher?.system?.groupSkills?.[gkey]) ? teacher.system.groupSkills[gkey] : [];
    entries.forEach(e => {
      if (!e?.rank || e.rank === "untrained") return;
      const spec = e.specialty || e.name || "—";
      out.push({ value: `group:${gkey}:${spec}`, label: `${gdef.label} (${spec})`, kind: "group", key: gkey, specialty: spec, rankLabel: e.rank });
    });
  }
  for (const item of (teacher?.items ?? [])) {
    if (item.type === "talent")
      out.push({ value: `talent:${item.name}`, label: item.name, kind: "talent", key: item.name });
  }
  // Клэйвекс учит не Навыку/Таланту, а искусству Инкубов — отдельная цель,
  // не производная от того, что у него есть на листе (buildTeachableTargets
  // перебирает ранги/Таланты, Элитный архетип в этот список не попадает).
  if (hasKlaivexTalent(teacher))
    out.push({ value: `archetype:${KLAIVEX_DISCOUNT_ARCHETYPE}`, label: "Искусство Инкубов (скидка на архетип Инкуб)",
               kind: "archetype", key: KLAIVEX_DISCOUNT_ARCHETYPE });
  return out;
}

export function findTeachableTarget(targets, value) { return targets.find(t => t.value === value) || null; }

/** Ученик — I+0 или Logic(I)+0 (книжный фиксированный выбор, без прочих Навыков). */
export function buildStudentTestOptions(student) {
  const intTotal = student?.system?.characteristics?.int?.total ?? 0;
  const logicTotal = student?.system?.skills?.logic?.total ?? (intTotal - 20);
  return [
    { value: "char:int", label: "Intelligence (I)", total: intTotal },
    { value: "skill:logic", label: "Logic (I)", total: logicTotal }
  ];
}
export function findStudentTestOption(options, value) { return options.find(o => o.value === value) || null; }

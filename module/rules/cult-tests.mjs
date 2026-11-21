// module/rules/cult-tests.mjs
// ════════════════════════════════════════════════════════════════════════
//  Чистая часть тестов кнопок пачки «культы» (combat/cult-common.mjs):
//  база теста по описанию { skill } | { group, spec } | { char } и подпись.
//  Без Foundry. Навык, которого у актора нет, — Характеристика −20
//  (нетренированный, стр. 22), как у surgical-precision.mjs.
// ════════════════════════════════════════════════════════════════════════

import { SKILLS_DEF, GROUP_SKILLS_DEF } from "../constants/skills.mjs";
import { CHARACTERISTICS } from "../constants/characteristics.mjs";
import { findGroupEntry } from "../constants/skill-specializations.mjs";
import { testOutcome } from "./roll-outcome.mjs";

const charTotal = (actor, key) => Number(actor?.system?.characteristics?.[key]?.total) || 0;

/**
 * База теста и ключи контекста для реестра правил.
 * @returns {{base:number, char:string, skill:?string, group:?string}}
 */
export function cultTestBase(actor, t = {}) {
  if (t.skill) {
    const char = t.charOverride || SKILLS_DEF[t.skill]?.char || "int";
    const total = actor?.system?.skills?.[t.skill]?.total;
    const base = Number.isFinite(Number(total)) && total != null ? Number(total) : charTotal(actor, char) - 20;
    return { base, char, skill: t.skill, group: null };
  }
  if (t.group) {
    const char = GROUP_SKILLS_DEF[t.group]?.char || "int";
    const entry = findGroupEntry(actor, t.group, t.spec);
    const base = Number.isFinite(entry?.total) ? entry.total : charTotal(actor, char) - 20;
    return { base, char, skill: null, group: t.group };
  }
  const char = t.char || "wp";
  return { base: charTotal(actor, char), char, skill: null, group: null };
}

/** «Charm+0», «Medicae−10», «Schol.Lore(Imperial Creed)+0», «W+0». */
export function cultTestLabel(t = {}) {
  const m = Number(t.mod) || 0;
  const sign = `${m < 0 ? "−" : "+"}${Math.abs(m)}`;
  if (t.label) return `${t.label}${sign}`;
  if (t.skill) return `${SKILLS_DEF[t.skill]?.en ?? t.skill}${sign}`;
  if (t.group) return `${GROUP_SKILLS_DEF[t.group]?.en ?? t.group}(${t.specLabel ?? t.spec})${sign}`;
  return `${CHARACTERISTICS[t.char || "wp"]?.abbr ?? t.char}${sign}`;
}

/** Исход теста: общее ядро rules/roll-outcome.mjs. */
export function cultTestOutcome(rv, threshold) {
  return testOutcome(rv, threshold);
}

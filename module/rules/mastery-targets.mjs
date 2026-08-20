// module/rules/mastery-targets.mjs
// ════════════════════════════════════════════════════════════════════════════
//  К чему привязывается «Mastery / Мастерство» (корбук стр. 62).
//
//  У этого Таланта вместо склонностей стоит «как у Навыка»: он наследует обе
//  склонности того Навыка, которым овладел, — от этого зависит и его цена
//  (стр. 23-24). Значит, привязка обязана быть частью самого Таланта, а не
//  подписью для глаза: пока она не выбрана, у Таланта нет ни склонностей, ни
//  цены.
//
//  Целей две породы, и обе настоящие:
//    обычный Навык       — «Уклонение», ключ `dodge`;
//    специализация группы — «Запретные знания (Демоны)», ключ `forbiddenLore:daemons`.
//  Группа целиком тоже остаётся целью (ключ `forbiddenLore`): так привязка
//  писалась раньше, и уже купленные Таланты не должны осиротеть.
//
//  Свободные специализации («<Регион>») в список не идут: у них нет предмета
//  владения, пока регион не назван, а назвать его тут негде.
//
//  Здесь нет ни Foundry, ни актора — только таблицы Навыков. Поэтому список
//  проверяется без запуска мира и одинаков всюду, где его показывают:
//  в покупке Таланта, в Конструкторе Механики и в Конструкторе требований.
// ════════════════════════════════════════════════════════════════════════════

import { SKILLS_DEF, GROUP_SKILLS_DEF } from "../constants/skills.mjs";
import { SKILL_SPECIALIZATIONS, specChar } from "../constants/skill-specializations.mjs";

/** Разделитель «группа : специализация» в ключе привязки. */
export const MASTERY_SEP = ":";

/**
 * Все цели «Мастерства» одним списком, в порядке показа: сперва обычные
 * Навыки, затем каждая группа и её специализации.
 *
 * @returns {{key: string, label: string, group?: string, spec?: string}[]}
 */
export function masteryTargets() {
  const out = [];

  for (const [key, def] of Object.entries(SKILLS_DEF)) {
    out.push({ key, label: def.label });
  }

  for (const [group, def] of Object.entries(GROUP_SKILLS_DEF)) {
    out.push({ key: group, label: `${def.label} (вся группа)`, group });
    for (const s of SKILL_SPECIALIZATIONS[group] || []) {
      if (s.free) continue;   // «<Регион>» — не предмет владения, пока не назван
      out.push({
        key: `${group}${MASTERY_SEP}${s.key}`,
        label: `${def.label} (${s.ru || s.label})`,
        group, spec: s.key
      });
    }
  }

  return out;
}

/** Цель по ключу привязки, либо null. */
export function masteryTarget(key) {
  if (!key) return null;
  return masteryTargets().find(t => t.key === key) || null;
}

/** Подпись цели для листа и подсказок: «Запретные знания (Демоны)». */
export function masteryLabel(key) {
  return masteryTarget(key)?.label || "";
}

/**
 * Склонности цели — их и наследует Талант.
 * У специализации бывает своя базовая Характеристика (Навигация (Варп) — это
 * Воля, а не Интеллект), поэтому первая склонность берётся у неё, а не у группы.
 *
 * @returns {string[]} две склонности, либо пусто, если ключ незнакомый
 */
export function masteryAptitudes(key) {
  const t = masteryTarget(key);
  if (!t) return [];
  if (!t.group) {
    const def = SKILLS_DEF[t.key];
    return def ? [def.char, def.apt2].filter(Boolean) : [];
  }
  const def = GROUP_SKILLS_DEF[t.group];
  if (!def) return [];
  const char = t.spec ? specChar(t.group, t.spec, def.char) : def.char;
  return [char, def.apt2].filter(Boolean);
}

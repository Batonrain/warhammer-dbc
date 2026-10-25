// module/rules/omophagea.mjs
//
// Омофагея (имплант Астартес, корбук «Геносемя»): «Съев мозг разумного
// существа, космодесантник может получить часть его воспоминаний, пройдя тест
// I+0. Полученные воспоминания случайны и определяются ГМом в зависимости от
// количества Успехов.» — 3-b530.
//
//  • Испробовать Душу (Taste the Soul, geneseed.core.tasteTheSoul): «+½ P
//    (окр.▲) на тесты использования Омофагеи». Книга везде пишет «.b» там, где
//    речь о бонусе, поэтому «P» прочитано как сама характеристика Восприятия
//    (Per), половина — с округлением вверх.
//  • Вор Памяти (Memory Thief, geneseed.core.memoryThief): «Успешно использовав
//    Омофагею, десантник может получить один из Навыков жертвы на том же уровне
//    продвижения на I.b суток. Не может иметь больше ½ I.b (окр.▲) таких бонусных
//    Навыков одновременно.» Срок и откат — как у Пожирателя Знаний
//    (rules/devourer-of-knowledge.mjs), только жертва ничего не теряет: её мозг
//    съеден, а не «одолжен».
//
// Чистая арифметика без Foundry; сборка записи и откат — apps/omophagea.mjs.

import { SKILL_RANKS } from "../constants/characteristics.mjs";
import { SKILLS_DEF, GROUP_SKILLS_DEF } from "../constants/skills.mjs";

export const TASTE_THE_SOUL_CAP = "geneseed.core.tasteTheSoul";
export const MEMORY_THIEF_CAP   = "geneseed.core.memoryThief";
/** Флаг актора с активными краденными Навыками: [{key, kind, skillKey, specialty, prev, expiresAt, label}]. */
export const MEMORY_THIEF_FLAG  = "memoryThiefSkills";
/** Тег теста Омофагеи для сбора модификаторов (rules/situational.mjs). */
export const OMOPHAGEA_TEST_TAG = "omophageaTest";

const DAY = 86400;
const bonusOf = rank => SKILL_RANKS[rank ?? "untrained"]?.bonus ?? -20;

/** +½ P (окр.▲). */
export function tasteTheSoulBonus(per) {
  return Math.ceil(Math.max(0, Number(per) || 0) / 2);
}

/** Сколько бонусных Навыков можно держать одновременно: ½ I.b (окр.▲), минимум 1 при I.b ≥ 1. */
export function memoryThiefMax(intBonus) {
  return Math.ceil(Math.max(0, Number(intBonus) || 0) / 2);
}

/** Срок в секундах: I.b суток. */
export function memoryThiefDurationSeconds(intBonus) {
  return Math.max(0, Number(intBonus) || 0) * DAY;
}

/** Записи, чей срок истёк. */
export function expiredMemoryThief(list, worldTime) {
  return (Array.isArray(list) ? list : []).filter(r => Number(worldTime) >= Number(r?.expiresAt));
}

/**
 * Навыки жертвы, которые можно перенять: изученные (выше «Не изучен»).
 * @returns {{id:string, kind:"plain"|"group", skillKey:string, specialty:string, specKey:string, rank:string, label:string}[]}
 */
export function memoryThiefCandidates(victim) {
  const out = [];
  for (const [skillKey, sk] of Object.entries(victim?.system?.skills ?? {})) {
    if (!SKILLS_DEF[skillKey] || !sk?.rank || sk.rank === "untrained") continue;
    out.push({ id: `p:${skillKey}`, kind: "plain", skillKey, specialty: "", specKey: "", rank: sk.rank,
      label: `${SKILLS_DEF[skillKey].label} — ${SKILL_RANKS[sk.rank]?.label ?? sk.rank}` });
  }
  for (const [skillKey, entries] of Object.entries(victim?.system?.groupSkills ?? {})) {
    if (!Array.isArray(entries) || !GROUP_SKILLS_DEF[skillKey]) continue;
    for (const e of entries) {
      if (!e?.rank || e.rank === "untrained") continue;
      const spec = e.specialty || e.specKey || "?";
      out.push({ id: `g:${skillKey}:${spec}`, kind: "group", skillKey, specialty: e.specialty || "", specKey: e.specKey || "",
        rank: e.rank, label: `${GROUP_SKILLS_DEF[skillKey].label} (${spec}) — ${SKILL_RANKS[e.rank]?.label ?? e.rank}` });
    }
  }
  return out;
}

/**
 * Что получает десантник: ступень жертвы, но не ниже собственной («получить…
 * на том же уровне» — своё, если оно выше, остаётся).
 * @returns {{rank:string, changed:boolean}}
 */
export function memoryThiefRank(ownRank, victimRank) {
  const own = ownRank || "untrained";
  return bonusOf(victimRank) > bonusOf(own) ? { rank: victimRank, changed: true } : { rank: own, changed: false };
}

/** Можно ли взять ещё один Навык (активных меньше ½ I.b). */
export function memoryThiefHasRoom(activeList, intBonus) {
  return (Array.isArray(activeList) ? activeList.length : 0) < memoryThiefMax(intBonus);
}

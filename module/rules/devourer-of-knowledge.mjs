// module/rules/devourer-of-knowledge.mjs
// ════════════════════════════════════════════════════════════════════════
//  Devourer of Knowledge / Пожиратель Знаний (Тзинч, wdbc-1rno, d100 37…40):
//  «Проведя 9 минут, касаясь другого персонажа, чемпион может узнать одно из
//  его воспоминаний или получить один из Навыков жертвы на том же уровне
//  изучения на 1 день. Жертва теряет поглощённые знания и Навыки на период,
//  пока чемпион ими пользуется. Если чемпион пожирает те же знания и Навыки
//  жертвы в течение 9 дней подряд, жертва перманентно теряет их, а чемпион
//  может продвигать эти Навыки до уровня жертвы, как если бы они были
//  союзными.»
//
//  «Воспоминание» — чистая нарративная половина, НЕ реализована (нечего
//  механизировать, тот же класс, что Чувство Похоти).
//
//  Кража Навыка — kind:"script" запись на предмете (packs-src, диалог выбора
//  Навыка + вся логика серии/отката). Этот файл несёт только то, что нужно
//  СНАРУЖИ скрипта: константы флагов, чистую проверку истечения (для тика
//  worldTime, hooks.mjs — тот же такт, что уже даёт Изгнанный из Смерти/
//  Укрепление Плотеметаллом) и рантайм-эффект перманентной кражи («как если
//  бы союзные» — существующий grantAptitudeOverride, item-rules.mjs, только
//  собран здесь ДИНАМИЧЕСКИ по флагу, а не статичной записью Конструктора:
//  украденный Навык у каждого игрока свой, автору пака заранее не известен).
// ════════════════════════════════════════════════════════════════════════

import { SKILL_RANKS } from "../constants/characteristics.mjs";
import { SKILLS_DEF } from "../constants/skills.mjs";

export const DEVOURER_OF_KNOWLEDGE_CAPABILITY = "gift.tzeentch.devourerOfKnowledge";

/** Флаг на НОСИТЕЛЕ — список активных временных краж (ещё не истёкших/не перманентных). */
export const DEVOURER_THEFTS_FLAG = "devourerOfKnowledgeThefts";

/** Флаг на НОСИТЕЛЕ — ключи Навыков, украденных ПЕРМАНЕНТНО (после 9 дней подряд). */
export const DEVOURER_PERMANENT_FLAG = "devourerOfKnowledgePermanent";

/** Секунд в игровых сутках — «1 день»/«9 дней подряд» книги считаются по «Календарю». */
export const DAY = 86400;

/** Номер календарного дня (целый) для данного worldTime. */
export function dayNumber(worldTime) {
  return Math.floor(Number(worldTime) / DAY);
}

/**
 * Записи временной кражи, чей срок истёк к этому тику worldTime —
 * вызывающая сторона (hooks.mjs) откатывает обе стороны и убирает запись.
 */
export function expiredTheftEntries(list, worldTime) {
  return (Array.isArray(list) ? list : []).filter(r => Number(worldTime) >= Number(r?.expiresAt));
}

/**
 * Правила от ПЕРМАНЕНТНО украденных Навыков — «как если бы союзные»
 * (дешевле Продвигать) через уже существующий эффект grantAptitudeOverride
 * (item-rules.mjs, capabilityMode:"aptOverride" у обычных записей Конструктора),
 * только собранный по флагу, а не по статичным данным пака.
 */
export function devourerPermanentRules(actor) {
  const list = actor?.getFlag?.("warhammer-dbc", DEVOURER_PERMANENT_FLAG) ?? [];
  if (!Array.isArray(list) || !list.length) return [];
  // aptitude-overrides.mjs::resolveAptitudeOverride сравнивает `match` с
  // ЛЕЙБЛОМ Навыка (advance-category.mjs зовёт его def.label, не ключом
  // схемы) — тот же формат, что руками вписывают в Конструкторе
  // (capabilityAptMatch), поэтому здесь ключ конвертируется в лейбл, а не
  // едет как есть (иначе override молча никогда бы не совпадал).
  return list.map(skillKey => ({
    id: `devourerOfKnowledge.permanent.${skillKey}`,
    label: `Пожиратель Знаний: «${SKILLS_DEF[skillKey]?.label ?? skillKey}» — Дружественный Навык`,
    when: {},
    effects: [{ kind: "grantAptitudeOverride", scope: "skill", match: SKILLS_DEF[skillKey]?.label ?? skillKey, align: "ally" }]
  }));
}

/**
 * Какая Ступень Навыка достаётся чемпиону при краже (временной и
 * перманентной). Вынесено из kind:"script" записи пака именно затем, чтобы
 * это можно было проверить тестом — внутри скрипта эта арифметика ошибалась
 * молча (приём стопки #478-#481, 14.09.2026).
 *
 * Две книжные оговорки, обе были нарушены:
 *
 * 1. Перманентная кража случается только когда вчерашняя ВРЕМЕННАЯ кража ещё
 *    жива, то есть Ступень жертвы ПРЯМО СЕЙЧАС уже обнулена в "untrained".
 *    Брать «текущую Ступень жертвы» в этот момент нельзя — надо брать ту,
 *    что запомнена в записи кражи (`victimPrevRank`). Иначе жертва теряет
 *    Навык навсегда, а чемпион получает «не изучен».
 * 2. Книга говорит «ПОЛУЧИТЬ один из Навыков жертвы на том же уровне
 *    изучения», а не «обменяться»: если собственная Ступень чемпиона выше,
 *    она остаётся. Прежний код присваивал Ступень жертвы безусловно и мог
 *    понизить чемпиона — во временной ветке на сутки, в перманентной навсегда.
 *
 * @param {{victimPrevRank?: string}|null} prevTheft  запись прошлой кражи
 * @param {string} victimRankNow   Ступень жертвы сейчас
 * @param {string} ownRank         Ступень чемпиона сейчас
 * @returns {{stolen: string, gained: string}} что украдено и что в итоге у чемпиона
 */
export function devouredSkillRank(prevTheft, victimRankNow, ownRank) {
  const bonus = r => SKILL_RANKS[r ?? "untrained"]?.bonus ?? -20;
  const stolen = prevTheft?.victimPrevRank || victimRankNow || "untrained";
  const own = ownRank || "untrained";
  return { stolen, gained: bonus(own) >= bonus(stolen) ? own : stolen };
}

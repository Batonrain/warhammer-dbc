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

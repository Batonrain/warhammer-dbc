// module/rules/training.mjs
// ════════════════════════════════════════════════════════════════════════
//  «Обучение» (книга — глава «Обучение», стр. 22): курс — 8 сеансов, учитель
//  Trade(Instructor)(I)+10, каждый ученик I+0 или Logic(I)+0, Успехи ОБОИХ
//  тестов суммируются (Провалы не вычитаются) → 5xp ученику за каждый общий
//  Успех, тратится ТОЛЬКО на то, чему учили (излишки сверх цены теряются).
//  Комбинированный тест учителя с Charm(F)+0/Logic(I)–10/Intimidate(W)+0 —
//  при успехе даёт +5×Успехи к ПРЕДЕЛУ теста каждого ученика этого курса.
//
//  Месячные лимиты: до I.b учеников в курсе (одномоментно, не окно времени);
//  не более ½I.b (окр.▲) курсов в месяц у ученика — здесь это РЕАЛЬНОЕ
//  скользящее окно по игровому времени (SECONDS_PER_MONTH), тот же приём,
//  что rules/drug-doses.mjs (DOSE_WEEK_SECONDS) для еженедельных доз.
//
//  Чистая логика, без Foundry (game/ui/canvas/Roll не используются) —
//  module/apps/craft-workshop.mjs вызывает это на исходе сеанса/курса.
// ════════════════════════════════════════════════════════════════════════

import { SECONDS_PER_MONTH } from "../constants/imperial-calendar.mjs";

// ── Целевой запас xp (ограничение «только на то, чему учили») ───────────────

/** Флаг actor, под которым живёт ЦЕЛЕВОЙ запас xp от курсов обучения. */
export const TRAINING_EARMARK_FLAG = "trainingEarmarks";
/** Флаг actor — журнал завершённых курсов (для месячного лимита ученика). */
export const TRAINING_COURSE_LOG_FLAG = "trainingCourseLog";

/** Канонический ключ цели обучения — тот же формат на выдаче xp и на покупке. */
export function trainingTargetKey({ kind, key, specialty } = {}) {
  const k = String(key || "").trim().toLowerCase();
  if (kind === "char")  return `char:${k}`;
  if (kind === "skill") return `skill:${k}`;
  if (kind === "group") return `group:${k}:${String(specialty || "").trim().toLowerCase()}`;
  if (kind === "talent") return `talent:${k}`;
  return "";
}

/** Сумма накопленного запаса по этой цели. */
export function earmarkTotal(log, targetKey) {
  return (Array.isArray(log) ? log : [])
    .filter(e => e.target === targetKey)
    .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
}

/** Начислить запас курсом — label для журнала/UI, без схлопывания записей (журнал читаем, не только суммируем). */
export function addTrainingEarmark(log, targetKey, label, amount) {
  const n = Number(amount) || 0;
  if (n <= 0) return Array.isArray(log) ? log : [];
  return [...(Array.isArray(log) ? log : []), { target: targetKey, label: label || "", amount: n }];
}

/**
 * Списать запас цели на покупку стоимостью cost — возвращает {discount, nextLog}.
 * Списывается ВЕСЬ запас цели сразу (а не только discount): книга — «лишние xp
 * теряются», то есть накопленное сверх цены этой конкретной покупки не
 * сохраняется на будущее, даже если потратить его было больше не на что.
 */
export function consumeTrainingEarmark(log, targetKey, cost) {
  const arr = Array.isArray(log) ? log : [];
  const total = earmarkTotal(arr, targetKey);
  const c = Math.max(0, Number(cost) || 0);
  if (total <= 0 || c <= 0) return { discount: 0, nextLog: arr };
  return { discount: Math.min(total, c), nextLog: arr.filter(e => e.target !== targetKey) };
}

// ── Журнал курсов (месячное окно, как rules/drug-doses.mjs::logDose) ────────

/**
 * Добавить завершённый курс в журнал (ключ — произвольный, напр. targetKey,
 * чтобы разные цели не путались при желании считать раздельно; здесь считаем
 * ОБЩИЙ месячный лимит ученика, поэтому ключ один — "course"). Чистит записи
 * старше месяца, как и дозы — тот же приём, другое окно.
 */
export function logCourse(log, key, now) {
  const next = { ...(log ?? {}) };
  const t = Number(now) || 0;
  const recent = (next[key] ?? []).filter(x => Number(x) > t - SECONDS_PER_MONTH);
  next[key] = [...recent, t];
  return next;
}

export function coursesThisMonth(log, key, now) {
  const t = Number(now) || 0;
  return (log?.[key] ?? []).filter(x => Number(x) > t - SECONDS_PER_MONTH).length;
}

// ── Лимиты по I.b ────────────────────────────────────────────────────────────

/** До I.b учеников в курсе (10×I.b — Teacher/Учитель, см. training-advantage.mjs). */
export function studentCapFromBonus(intBonus, teacherTalentActive) {
  const b = Math.max(0, Number(intBonus) || 0);
  return teacherTalentActive ? b * 10 : b;
}

/**
 * Не более ½I.b (окр.▲) курсов в месяц у ученика. NPC у держателя Teacher —
 * 2×I.b УЧИТЕЛЯ вместо ½I.b УЧЕНИКА (книга благо Teacher, иной счёт на входе).
 */
export function studentMonthlyCap(studentIntBonus, { npcUnderTeacherTalent = false, teacherIntBonus = 0 } = {}) {
  if (npcUnderTeacherTalent) return Math.max(0, Number(teacherIntBonus) || 0) * 2;
  return Math.ceil(Math.max(0, Number(studentIntBonus) || 0) / 2);
}

// ── Тесты курса ───────────────────────────────────────────────────────────

/** Combined-тест учителя: Trade(Instructor) ведущий, соц. Навык (если выбран) — только ранг (без craft-синергии). */
export function teacherCombinedLimit(instructorOpt, socialOpt) {
  const base = Number(instructorOpt?.total || 0) + 10; // Trade(Instructor)(I)+10
  if (!socialOpt) return base;
  return base + Number(socialOpt.rankBonus || 0) + Number(socialOpt.mod || 0);
}

/** Бонус ученикам к Пределу от успешного combined-теста учителя: +5×Успехи. */
export function studentBonusFromTeacherCombo(comboDos) {
  return comboDos > 0 ? 5 * comboDos : 0;
}

/**
 * xp ученику за курс: 5×(Успехи учителя + Успехи ученика), Провалы НЕ
 * вычитаются — каждый компонент клампится к 0 до суммы. doubleTeacher —
 * Teacher/Учитель удваивает именно УСПЕХИ УЧИТЕЛЯ (не ученика).
 */
export function trainingXpGain(teacherDos, studentDos, { doubleTeacher = false } = {}) {
  const t = Math.max(0, Number(teacherDos) || 0) * (doubleTeacher ? 2 : 1);
  const s = Math.max(0, Number(studentDos) || 0);
  return 5 * (t + s);
}

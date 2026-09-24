// module/rules/useless-limbs.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Бесполезные Конечности (книга, «Раны и Урон» → «Бесполезные Конечности и
//  Ампутация»; wdbc-x1nz.2.99).
//
//  «Некоторые Критические Эффекты (обычно переломы костей) приводят к тому,
//  что конечность становится бесполезной до оказания медицинской помощи»:
//    • помощь — 5 минут и тест Medicae+0; Успех — конечность бесполезна ещё
//      2d10−T.b суток (минимум 1) в лубке; Провал — зафиксирована неправильно;
//    • попыток — до T.b пациента, все провалены — перманентно бесполезна:
//      ампутация, иначе через T.b дней 60% Гангрены;
//    • без помощи 2×T.b часов — перманентно бесполезна: ампутация, иначе
//      через T.b дней 70% Гангрены.
//  Плюс временная бесполезность из крит-таблиц («Рука становится
//  бесполезной на 1d10 Раундов»), лечения не требующая.
//
//  Хранение — по каждой конечности (решение владельца, 24.09.2026):
//  system.uselessLimbs.{rightArm,leftArm,rightLeg,leftLeg}, у каждой свои
//  срок, попытки и Гангрена. «Ступня бесполезна» — это нога (решение
//  владельца: для SPD потеря стопы и ноги уже работают одинаково).
//  Состояния «Бесполезная рука/нога» на токене и листе — зеркала
//  (rules/condition-mirrors.mjs), своего хранения у них нет.
//
//  Чистый модуль: читает переданный system, возвращает патчи для
//  actor.update — ни одного обращения к Foundry.
// ════════════════════════════════════════════════════════════════════════════

import { SECONDS_PER_DAY } from "../constants/imperial-calendar.mjs";

const SECONDS_PER_HOUR = 3600;

/** Конечность → тип («arm»/«leg»). Ключи — те же, что у брони (HIT_LOCATIONS). */
export const USELESS_SIDES = { rightArm: "arm", leftArm: "arm", rightLeg: "leg", leftLeg: "leg" };

export const SIDE_LABELS = { rightArm: "П. Рука", leftArm: "Л. Рука", rightLeg: "П. Нога", leftLeg: "Л. Нога" };

/** Место попадания карточки урона → конечность (без стороны — правая, как у брони). */
export const LOCATION_TO_SIDE = {
  "П. Рука": "rightArm", "Л. Рука": "leftArm", "Рука": "rightArm",
  "П. Нога": "rightLeg", "Л. Нога": "leftLeg", "Нога": "rightLeg"
};

/**
 * Состояния лечения:
 *   untreated — помощи не было, идут часы 2×T.b;
 *   misset    — зафиксирована неправильно (Провал), можно пытаться ещё;
 *   splinted  — в лубке, срок заживления идёт;
 *   permanent — перманентно бесполезна, ждёт ампутации / Гангрены.
 */
export const STATE_LABELS = {
  untreated: "без помощи", misset: "зафиксирована неправильно",
  splinted: "в лубке", permanent: "перманентно"
};

export const NO_AID_GANGRENE_CHANCE = 70;
export const FAILED_SET_GANGRENE_CHANCE = 60;

const path = (side, field) => `system.uselessLimbs.${side}.${field}`;
const tbOf = tb => Math.max(0, Number(tb) || 0);

function entryOf(system, side) {
  return system?.uselessLimbs?.[side] ?? {};
}

/** Бесполезна ли конечность прямо сейчас (лечением или на Раунды). */
export function isSideUseless(entry) {
  return !!entry?.state || (Number(entry?.rounds) || 0) > 0;
}

/** Бесполезные конечности этого типа. */
export function uselessSides(system, type) {
  return Object.keys(USELESS_SIDES)
    .filter(side => USELESS_SIDES[side] === type && isSideUseless(entryOf(system, side)));
}

/** Сколько рук/ног бесполезно — для бюджета рук, SPD, Уклонения. */
export function uselessCount(system, type) {
  return uselessSides(system, type).length;
}

/**
 * Какую конечность делать бесполезной: указанную (если её тип совпадает),
 * иначе первую ещё целую этого типа, иначе первую этого типа.
 */
export function pickSide(system, type, preferred = "") {
  if (USELESS_SIDES[preferred] === type) return preferred;
  const sides = Object.keys(USELESS_SIDES).filter(s => USELESS_SIDES[s] === type);
  return sides.find(s => !isSideUseless(entryOf(system, s))) ?? sides[0];
}

/** Патч «конечность снова в порядке». */
export function clearSideFields(side) {
  return {
    [path(side, "state")]: "", [path(side, "rounds")]: 0, [path(side, "noAidAt")]: 0,
    [path(side, "healAt")]: 0, [path(side, "attempts")]: 0, [path(side, "healMod")]: 0,
    [path(side, "gangreneAt")]: 0, [path(side, "gangreneChance")]: 0
  };
}

/**
 * Сделать конечность бесполезной.
 * rounds > 0 — временно, на Раунды (лечения не нужно; второй такой эффект
 * не укорачивает уже идущий срок). Иначе — до лечения: пошли часы 2×T.b.
 * Перелом поверх лубка сбрасывает лечение заново; перманентная так и
 * остаётся перманентной.
 * healMod — «Тесты лечения бесполезной конечности получают штраф −20».
 */
export function uselessApplyFields(system, side, { rounds = 0, healMod = 0, worldTime = 0, tb = 0 } = {}) {
  const cur = entryOf(system, side);
  if (rounds > 0) {
    return { [path(side, "rounds")]: Math.max(Number(cur.rounds) || 0, rounds) };
  }
  const mod = Math.min(Number(cur.healMod) || 0, Number(healMod) || 0);
  if (cur.state === "permanent") return { [path(side, "healMod")]: mod };
  return {
    [path(side, "state")]: "untreated",
    [path(side, "noAidAt")]: Number(worldTime) + 2 * tbOf(tb) * SECONDS_PER_HOUR,
    [path(side, "healAt")]: 0,
    [path(side, "attempts")]: 0,
    [path(side, "healMod")]: mod
  };
}

/**
 * Часы игрового времени за отрезок до `to`. Возвращает события по порядку:
 *   { side, kind: "noAid" }        — 2×T.b часов без помощи: перманентно;
 *   { side, kind: "healed" }       — срок в лубке вышел: конечность цела;
 *   { side, kind: "gangreneDue", chance } — T.b дней перманентной: бросок.
 * и общий patch. Бросок Гангрены делает вызывающий слой (Foundry Roll).
 */
export function uselessClockStep(system, { to, tb = 0 } = {}) {
  const patch = {};
  const events = [];
  const days = tbOf(tb) * SECONDS_PER_DAY;
  for (const side of Object.keys(USELESS_SIDES)) {
    const e = { ...entryOf(system, side) };
    if (e.state === "untreated" && Number(e.noAidAt) > 0 && to >= Number(e.noAidAt)) {
      e.state = "permanent";
      e.gangreneAt = Number(e.noAidAt) + days;
      e.gangreneChance = NO_AID_GANGRENE_CHANCE;
      Object.assign(patch, {
        [path(side, "state")]: "permanent", [path(side, "noAidAt")]: 0,
        [path(side, "gangreneAt")]: e.gangreneAt, [path(side, "gangreneChance")]: e.gangreneChance
      });
      events.push({ side, kind: "noAid" });
    }
    if (e.state === "splinted" && Number(e.healAt) > 0 && to >= Number(e.healAt)) {
      Object.assign(patch, clearSideFields(side), { [path(side, "rounds")]: Number(e.rounds) || 0 });
      events.push({ side, kind: "healed" });
      continue;
    }
    if (e.state === "permanent" && Number(e.gangreneAt) > 0 && to >= Number(e.gangreneAt)) {
      patch[path(side, "gangreneAt")] = 0;
      events.push({ side, kind: "gangreneDue", chance: Number(e.gangreneChance) || NO_AID_GANGRENE_CHANCE });
    }
  }
  return { patch, events };
}

/** Начало Хода: временная бесполезность тает на 1 Раунд. */
export function uselessRoundTick(system) {
  const patch = {};
  const ticks = [];
  for (const side of Object.keys(USELESS_SIDES)) {
    const cur = Number(entryOf(system, side).rounds) || 0;
    if (cur <= 0) continue;
    patch[path(side, "rounds")] = cur - 1;
    ticks.push({ side, from: cur, to: cur - 1 });
  }
  return { patch, ticks };
}

/** Какие конечности сейчас можно лечить («Зафиксировать»): не в лубке и не перманентные. */
export function settableSides(system) {
  return Object.keys(USELESS_SIDES)
    .filter(side => ["untreated", "misset"].includes(entryOf(system, side).state));
}

/**
 * Итог попытки зафиксировать конечность.
 * Успех — в лубке на `days` суток (вызывающий кидает 2d10−T.b, мин. 1).
 * Провал — +1 попытка; исчерпаны все T.b (минимум одна) — перманентно, через
 * T.b дней 60% Гангрены.
 * @returns {{patch: object, result: "splinted"|"misset"|"permanent", attempts: number, maxAttempts: number}}
 */
export function setLimbOutcome(system, side, { success, days = 1, worldTime = 0, tb = 0 } = {}) {
  const cur = entryOf(system, side);
  const maxAttempts = Math.max(1, tbOf(tb));
  if (success) {
    return {
      result: "splinted", attempts: Number(cur.attempts) || 0, maxAttempts,
      patch: {
        [path(side, "state")]: "splinted", [path(side, "noAidAt")]: 0,
        [path(side, "healAt")]: Number(worldTime) + Math.max(1, days) * SECONDS_PER_DAY
      }
    };
  }
  const attempts = (Number(cur.attempts) || 0) + 1;
  if (attempts >= maxAttempts) {
    return {
      result: "permanent", attempts, maxAttempts,
      patch: {
        [path(side, "state")]: "permanent", [path(side, "noAidAt")]: 0, [path(side, "attempts")]: attempts,
        [path(side, "gangreneAt")]: Number(worldTime) + tbOf(tb) * SECONDS_PER_DAY,
        [path(side, "gangreneChance")]: FAILED_SET_GANGRENE_CHANCE
      }
    };
  }
  return {
    result: "misset", attempts, maxAttempts,
    patch: { [path(side, "state")]: "misset", [path(side, "noAidAt")]: 0, [path(side, "attempts")]: attempts }
  };
}

/**
 * Ампутация/операция снимает бесполезность одной конечности этого типа —
 * первой перманентной, иначе первой любой. null — снимать нечего.
 */
export function sideToAmputate(system, type) {
  const sides = uselessSides(system, type);
  return sides.find(s => entryOf(system, s).state === "permanent") ?? sides[0] ?? null;
}

/** Подсказка тега «Бесполезная рука/нога»: «П. Рука — в лубке; Л. Рука — 3 Раунда». */
export function uselessHint(system, type) {
  return uselessSides(system, type).map(side => {
    const e = entryOf(system, side);
    const parts = [];
    if (e.state) parts.push(STATE_LABELS[e.state] ?? e.state);
    if ((Number(e.rounds) || 0) > 0) parts.push(`${e.rounds} Раунд.`);
    return `${SIDE_LABELS[side]} — ${parts.join(", ")}`;
  }).join("; ");
}

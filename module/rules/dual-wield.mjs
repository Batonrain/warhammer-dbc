// module/rules/dual-wield.mjs
// ════════════════════════════════════════════════════════════════════════════
//  АТАКА ДВУМЯ ОРУЖИЯМИ (wdbc-3jlm). Талант «Two Weapon Wielder / Два Оружия»:
//  «персонаж может совершать атаки с обеих рук КАК ОДНУ атаку, занимающую
//  наибольшее действие из двух, но эти атаки получают −20».
//
//  До этого модуля вся ветка «Два оружия» — пятнадцать Талантов — стояла в
//  реестре возможностей с пустым reader: игрок делал два отдельных броска,
//  каждый съедал свои ОД (то есть пара ударов стоила 2 ОД вместо 1), а весь
//  штраф и скидки к нему держал в голове и вписывал руками в «Доп. мод».
//
//  ЗДЕСЬ только арифметика и условия — чистые функции, ничего про Foundry и
//  ничего про интерфейс. Кто их зовёт: окно атаки (module/sheets/attack/).
//
//  ── Как складывается штраф ──────────────────────────────────────────────
//  −20 за пару (сам Талант «Два Оружия») и отдельно −20 за неосновную руку.
//  Скидки книги уменьшают ПАРНЫЙ штраф по −10 за каждый подходящий Талант и
//  складываются: Амбидекстр + Македонец на паре пистолетов гасят парный штраф
//  целиком. Амбидекстр вдобавок снимает штраф неосновной руки полностью —
//  это его первая половина, отдельная от скидки.
//
//  Штраф не уходит в плюс: скидок больше, чем штрафа, — значит просто ноль,
//  а не бонус. Книга нигде не обещает бонуса за парное оружие.
// ════════════════════════════════════════════════════════════════════════════

import { hasRuleFlag } from "./flags.mjs";

/** −20 за пару (сам Талант «Два Оружия»). */
export const PAIR_PENALTY = -20;
/** −20 за оружие в неосновной руке; снимается Амбидекстром. */
export const OFF_HAND_PENALTY = -20;
/** Шаг скидки: каждый подходящий Талант — 10. */
export const REDUCTION_STEP = 10;

export const CAP_TWO_WEAPON   = "dualWield.core.twoWeaponWielder";
export const CAP_AMBIDEXTROUS = "dualWield.core.ambidextrous";

/** Скидки −10 к парному штрафу: возможность → когда действует. */
const REDUCTIONS = [
  { cap: "dualWield.core.ambidextrous", label: "Амбидекстр",
    when: () => true },
  { cap: "dualWield.core.bladeDancer", label: "Танцор с Клинками",
    when: (a, b) => melee(a, "Меч") && melee(b, "Меч") },
  { cap: "dualWield.core.brawler", label: "Боксёр",
    when: (a, b) => melee(a, "Кулаки") && melee(b, "Кулаки") },
  { cap: "dualWield.core.fanOfKnives", label: "Веер Ножей",
    when: (a, b) => cls(a) === "thrown" && cls(b) === "thrown" },
  { cap: "dualWield.core.gunslinger", label: "Македонец",
    when: (a, b) => cls(a) === "pistol" && cls(b) === "pistol" },
  { cap: "dualWield.core.sidearm", label: "Запасной Ствол",
    when: (a, b) => (cls(a) === "pistol" && cls(b) === "melee")
                 || (cls(b) === "pistol" && cls(a) === "melee") },
  { cap: "dualWield.core.sideblade", label: "Запасной Клинок",
    when: (a, b) => melee(a, "Нож") || melee(b, "Нож") }
];

const cls   = w => String(w?.system?.weaponClass ?? "");
const melee = (w, category) => cls(w) === "melee"
  && String(w?.system?.meleeCategory ?? "").trim().toLowerCase() === category.toLowerCase();

/** Умеет ли персонаж бить обеими руками одним действием. */
export function canDualWield(actor) {
  return hasRuleFlag(actor, CAP_TWO_WEAPON);
}

/**
 * Разбор штрафа парной атаки — числа И их подписи: игрок должен видеть, из
 * чего сложилось, а не готовый минус.
 *
 * @returns {{pair:number, offHand:number, reductions:Array<{label:string,value:number}>}}
 *   pair — штраф обеим атакам, offHand — добавка только неосновной руке.
 */
export function dualWieldMods(actor, main, off) {
  const reductions = REDUCTIONS
    .filter(r => r.when(main, off) && hasRuleFlag(actor, r.cap))
    .map(r => ({ label: r.label, value: REDUCTION_STEP }));

  const total = reductions.reduce((n, r) => n + r.value, 0);
  // Штраф гасится до нуля, но не переворачивается в бонус.
  const pair = Math.min(0, PAIR_PENALTY + total);

  return {
    pair,
    offHand: hasRuleFlag(actor, CAP_AMBIDEXTROUS) ? 0 : OFF_HAND_PENALTY,
    reductions
  };
}

const ACTION_WEIGHT = { "Свободное действие": 0, "Полудействие": 1, "Полное действие": 2 };

/**
 * Действие, которое занимает парная атака — НАИБОЛЬШЕЕ из двух, а не сумма.
 * В этом весь смысл Таланта: пара ударов стоит одного действия.
 * Незнакомое имя действия считаем Полудействием — так же, как одиночная
 * атака (стрелковые режимы, кроме Подавления, все Полудействия).
 */
export function dualWieldActionType(a, b) {
  const wa = ACTION_WEIGHT[a] ?? 1;
  const wb = ACTION_WEIGHT[b] ?? 1;
  const heavier = wa >= wb ? a : b;
  return ACTION_WEIGHT[heavier] === undefined ? "Полудействие" : heavier;
}

/**
 * Годится ли предмет во вторую руку: оружие, не то же самое, и не
 * врождённая атака, которую нельзя взять в руку отдельно.
 */
export function offHandCandidates(actor, main) {
  return [...(actor?.items ?? [])].filter(it =>
    it?.type === "weapon" && it.id !== main?.id && it.system?.equipped);
}

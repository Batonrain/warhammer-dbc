// module/rules/focused-wrath.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Focused Wrath / Сфокусированный Гнев (Талант Берсерка, Sahara focused-wrath-20-bs,
//  пачка J). Книга: «Ненависть направляет руку персонажа. Когда он использует Очко
//  Бесчестия для РУКОПАШНОЙ атаки по Ненавистной цели, он усиливает эффект:
//    Усиление: +20 вместо +10;
//    Переброс: также дает Преимущество;
//    Успех: еще +1 Успех;
//    Атака Ненависти: Inf.b Успехов вместо 1 (мин.1)».
//
//  Что из четырёх режимов считает код, а что — памятка:
//   • Усиление — «+10 за Очко» в меню карточки атаки (hooks.mjs::doBonus);
//   • Переброс — переброс атаки за Очко (hooks.mjs::doReroll): новый бросок катается
//     дважды, оставляется лучший (opts.reroll, combat/attack.mjs);
//   • Атака Ненависти (Покровительство Кхорна) — окно атаки (sheets/attack/dialog.mjs);
//   • Успех — пункт «Успех» меню карточки теста (apps/infamy-success.mjs, решение владельца
//     27.10.2026) дописывает Успех в карточку; здесь он получает ещё +1. Памятки с полосы
//     (focusedWrathBarNote) остались только у «Усиления» и «Переброса».
//
//  «Ненавистная цель» — тот же отбор, что у самого Hatred (hatredTargetsOf +
//  anyTargetMatches). Чистый модуль без Foundry; не импортируется из sources.mjs.
//  Талант опознаётся по имени (долг wdbc-iadw): имя — литералом в вызове itemHasName,
//  так его находит tools/capability-reachability.mjs.
// ════════════════════════════════════════════════════════════════════════════

import { itemHasName, hatredTargetsOf } from "./predicates.mjs";
import { anyTargetMatches } from "./talent-targets.mjs";
import { FATE_BONUS } from "./fate-bonus.mjs";

/** «Усиление: +20 вместо +10». */
export const FOCUSED_WRATH_BOOST = 20;
/** «Переброс: также дает Преимущество» — два броска d100, лучший (меньший) остаётся (opts.reroll атаки). */
export const FOCUSED_WRATH_REROLL = Object.freeze({ rolls: 2, mode: "keepBest" });

export const hasFocusedWrath = actor => [...(actor?.items ?? [])].some(i =>
  i?.type === "talent" && (itemHasName(i, "Focused Wrath") || itemHasName(i, "Сфокусированный Гнев")));

/**
 * Усиливает ли Талант трату Очка на ЭТУ атаку: он у актора есть, атака рукопашная,
 * цель известна и подходит под Ненависть.
 * @param {object} actor
 * @param {{isMelee:boolean, targetActor:?object}} ctx
 */
export function focusedWrathApplies(actor, { isMelee, targetActor } = {}) {
  if (!isMelee || !targetActor || !hasFocusedWrath(actor)) return false;
  const hated = hatredTargetsOf(actor);
  return hated.length > 0 && anyTargetMatches(hated, { targetActor });
}

/** Успехов «Атаки Ненависти»: Inf.b (минимум 1) с Талантом на Ненавистной цели, иначе 1. */
export function hateAttackDegrees(actor, ctx) {
  if (!focusedWrathApplies(actor, ctx)) return 1;
  return Math.max(1, Math.trunc(Number(actor?.system?.characteristics?.inf?.bonus) || 0));
}

const BAR_NOTES = {
  boost: "Сфокусированный Гнев: если это рукопашная атака по Ненавистной цели — Усиление даёт +20 вместо +10.",
  reroll: "Сфокусированный Гнев: если это рукопашная атака по Ненавистной цели — переброс с Преимуществом (бросить дважды, оставить лучший).",
};

/**
 * Памятка для карточки траты Очка с полосы (apps/infamy-points.mjs): пустая строка,
 * если усиления нет. Полоса не знает, к какой атаке относится трата, поэтому смотрим
 * на отмеченные цели: все они должны быть Ненавистными; рукопашность уточняет сама фраза.
 * @param {object} actor
 * @param {string} key         ключ способности («boost», «reroll», «success»…)
 * @param {object[]} targetActors  акторы отмеченных целей
 */
export function focusedWrathBarNote(actor, key, targetActors) {
  const note = BAR_NOTES[key];
  if (!note || !hasFocusedWrath(actor)) return "";
  const targets = (targetActors ?? []).filter(Boolean);
  if (!targets.length) return "";
  const hated = hatredTargetsOf(actor);
  if (!hated.length || !targets.every(t => anyTargetMatches(hated, { targetActor: t }))) return "";
  return note;
}

/**
 * Опции повторной атаки при переброске за Очко. С усилением Сфокусированного Гнева — переброс
 * катается дважды и остаётся лучший (opts.reroll атаки, combat/attack.mjs); переброс, уже
 * заданный правилом (Локус Буйства и подобные), не затираем.
 * @returns {object} новые опции (исходный объект не меняется)
 */
export function wrathRerollOpts(atkOpts, applies) {
  const opts = { ...(atkOpts ?? {}) };
  if (applies && !opts.reroll) opts.reroll = { ...FOCUSED_WRATH_REROLL };
  return opts;
}

/** Надбавка «+10 за Очко» к порогу атаки: +20 при усилении Сфокусированного Гнева, иначе +10. */
export const attackBoostFor = applies => (applies ? FOCUSED_WRATH_BOOST : FATE_BONUS);

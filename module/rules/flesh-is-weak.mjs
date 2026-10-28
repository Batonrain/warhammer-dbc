// module/rules/flesh-is-weak.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Плоть Слаба / Flesh is Weak (Талант Механикума, Sahara 3-cc96 п.7; DoomBC —
//  Основная книга): «Персонаж увеличивает рейтинг Трейта Machine на 1. Можно
//  брать до ½I.b (окр.▲) раз.» Требование — Трейт Machine.
//
//  Каждая копия Таланта поднимает рейтинг одного Трейта Machine на 1, а броня
//  Machine (+X AP на все участки) — пересчитывается под новый рейтинг. Какую из
//  нескольких Machine повышать, книга не уточняет (вторая копия бывает от
//  Кибернетического Перерождения, решение владельца 25.10.2026: замысел Таланта),
//  поэтому берётся Machine с наибольшим рейтингом: сумма AP от этого не зависит,
//  а лист не получает россыпь «Machine (3), Machine (4)».
//
//  Предел ½I.b — ограничение ПОКУПКИ (как у Cybernetic Excellence и Gaze Into
//  Abyss): упал I.b после урона — уже взятые копии продолжают действовать, поэтому
//  считаются все копии, а предел — только подсказка (flesh-is-weak cap).
//
//  Чистый модуль без Foundry; Foundry-часть — module/apps/flesh-is-weak.mjs.
// ════════════════════════════════════════════════════════════════════════════

import { itemHasName } from "./predicates.mjs";

export const FIW_CONTRIB_FLAG = "fiwContribution";

/** Талант Flesh is Weak / Плоть Слаба. */
export const isFleshIsWeak = item =>
  item?.type === "talent" && (itemHasName(item, "Flesh is Weak") || itemHasName(item, "Плоть Слаба"));

/** Трейт Machine / Машина (X); «Machine Empathy» — Талант, не совпадает по типу. */
export const isMachineTrait = item =>
  item?.type === "trait"
  && (itemHasName(item, "Machine") || itemHasName(item, "Машина")
    || String(item.name ?? "").startsWith("Machine / Машина"));

/** Сколько копий Таланта на акторе — столько единиц рейтинга Machine он добавляет. */
export const fleshIsWeakCopies = items => [...(items ?? [])].filter(isFleshIsWeak).length;

/** Книжный предел покупок: ½I.b, округление вверх. */
export const fleshIsWeakCap = intBonus => Math.ceil(Math.max(0, Number(intBonus) || 0) / 2);

const ratingOf = trait => Math.max(0, Number(trait?.system?.rating) || 0);
/** Сколько единиц рейтинга Трейту прибавил сам Талант (флаг вклада на Трейте); 0 — ничего. */
export const contribOf = trait =>
  Math.max(0, Number(trait?.flags?.["warhammer-dbc"]?.[FIW_CONTRIB_FLAG]
    ?? trait?.getFlag?.("warhammer-dbc", FIW_CONTRIB_FLAG)) || 0);

/**
 * Что делать с Machine после «Обновить мир» (apps/content-sync.mjs; task решение
 * владельца 26.10.2026, вариант B). Сверка пишет в Трейт значение пака и затирает
 * +N от Таланта (рейтинг и броню-эффекты), а флаг вклада остаётся — и
 * planFleshIsWeak видит «копий столько же, сколько записано», то есть ничего не
 * возвращает. Пересчёт идёт ТОЛЬКО по факту такой правки, а не на любое
 * изменение Трейта: реакция на любой updateItem прибавила бы +N второй раз при
 * ручной правке рейтинга ГМом.
 *
 * `ratingOverwritten` — сверка записала рейтинг из пака (теперь он «базовый»);
 * иначе рейтинг на Трейте прежний, он уже включает +N, а «базовый» — без него.
 * `effectsReplaced` — сверка пересоздала эффекты Трейта по паку: они посчитаны под
 * базовый рейтинг и должны быть пересчитаны под базовый + N.
 * null — делать нечего.
 * @returns {{newRating:?number, effects:?{from:number,to:number}}|null}
 */
export function planFleshIsWeakAfterSync({ rating, contribution, ratingOverwritten = false, effectsReplaced = false }) {
  const n = Math.max(0, Number(contribution) || 0);
  if (!n || (!ratingOverwritten && !effectsReplaced)) return null;
  const current = Math.max(0, Number(rating) || 0);
  const base = ratingOverwritten ? current : Math.max(0, current - n);
  const target = base + n;
  return {
    newRating: ratingOverwritten ? target : null,
    effects: effectsReplaced && base !== target ? { from: base, to: target } : null
  };
}

/**
 * План синхронизации: на какой Machine и на сколько изменить рейтинг.
 * `target` — Трейт, чей рейтинг правится; `delta` — на сколько; `contribution` —
 * новое значение флага вклада на нём (0 — флаг снять).
 * null — менять нечего.
 *
 * Если вклад уже записан на каком-то Machine, правится ИМЕННО он (иначе при
 * смене «лучшего» Трейта вклад осел бы на двух копиях). Нет Machine вовсе — Талант
 * без своего Трейта ничего не поднимает, плана нет.
 */
export function planFleshIsWeak(items) {
  const list = [...(items ?? [])];
  const copies = fleshIsWeakCopies(list);
  const machines = list.filter(isMachineTrait);
  const tracked = machines.find(m => contribOf(m) > 0) ?? null;
  const prev = tracked ? contribOf(tracked) : 0;
  if (tracked) {
    if (copies === prev) return null;
    return { target: tracked, delta: copies - prev, contribution: copies };
  }
  if (!copies || !machines.length) return null;
  const target = [...machines].sort((a, b) => ratingOf(b) - ratingOf(a))[0];
  return { target, delta: copies, contribution: copies };
}

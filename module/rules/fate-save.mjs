// module/rules/fate-save.mjs
//
// «Пламенная вера» (Мир-храм): всякий раз, когда персонаж тратит Очко
// Судьбы/Бесчестья, бросается 1d10, и при 1 очко не тратится.
//
// Здесь только счётная часть: сколько кубов бросать и сколько Очков вернуть.
// Сам бросок и запись в актора — хук на updateActor (warhammer-dbc.mjs): ловим
// ЛЮБОЕ уменьшение system.fate.value одним местом, а не правим каждое из
// мест, что списывают Очки (лист, hooks.mjs, Боль/Душа). Так правило не
// разойдётся с системой, когда появится новое место траты.

/** Возможность из реестра правил (rules/library/homeworlds.mjs). */
export const FATE_SAVE_FLAG = "fate.save";

/** Формула и грань возврата — книга, Мир-храм. */
export const FATE_SAVE_DIE = "1d10";
export const FATE_SAVE_ON  = 1;

/**
 * Сколько Очков потрачено этой правкой. Восстановление и рост пула — не трата:
 * возвращает 0, и бросать нечего.
 */
export function fateSpent(prev, next) {
  const a = Number(prev), b = Number(next);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.max(0, a - b);
}

/**
 * Сколько Очков возвращает выпавшее. Трата сразу нескольких Очков — это
 * несколько отдельных трат, значит и бросков столько же, а не один на всё.
 */
export function fateSaved(rolls = []) {
  return rolls.filter(r => Number(r) === FATE_SAVE_ON).length;
}

/**
 * Как называется пул у этого актора. Поле одно (system.fate.value), а
 * называется по мировоззрению: у хаосита это Очки Бесчестья.
 */
export function fatePoolLabel(actor) {
  return actor?.system?.alignment === "heretic" ? "Бесчестья" : "Судьбы";
}

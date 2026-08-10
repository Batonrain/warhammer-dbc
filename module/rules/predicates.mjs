// module/rules/predicates.mjs
//
// Реестр условий (`when`) для правил. Каждый предикат — чистая функция
// (actor, ctx, value) => boolean. Ни обращений к game/ui/canvas, ни бросков:
// иначе правило не проверить тестом без запуска Foundry, а ради этого всё и
// затевалось. Формат записи — docs/rules-format.md.

/** Значение условия к списку: строка считается списком из одного элемента. */
const list = v => (v == null ? [] : Array.isArray(v) ? v : [v]);

const norm = s => String(s ?? "").trim().toLowerCase();

/**
 * Имена Талантов и Черт в системе двуязычные: «Gene-Seed / Геносемя».
 * Сравниваем по любой половине; специализация в скобках на конце
 * («Resistance (Cold)») при сравнении отбрасывается.
 */
function itemHasName(item, wanted) {
  const w = norm(wanted);
  if (!w) return false;
  return norm(item?.name).split("/").some(part => {
    const p = part.trim();
    return p === w || p.replace(/\s*\([^)]*\)\s*$/, "").trim() === w;
  });
}

/**
 * Есть ли у актора Талант или Черта с каждым из перечисленных имён.
 *
 * Список означает «и», а не «или»: правило с двумя вариантами записывается
 * двумя правилами, а вот требование двух Талантов сразу иначе не выразить.
 *
 * Типы «talent» и «trait» намеренно не разделяются — так же ведёт себя
 * разборщик требований талантов (constants/talent-requirements.mjs), и правило
 * не должно молча не сработать из-за того, что содержимое записано Чертой.
 */
function hasNamed(actor, names) {
  const items = [...(actor?.items ?? [])];
  return list(names).every(name => items.some(
    i => (i?.type === "talent" || i?.type === "trait") && itemHasName(i, name)));
}

/**
 * Итоговый Размер актора: базовый `system.size` плюс вклад Черт `system.sizeMod`.
 * Лист кладёт сумму в `system.sizeTotal` (documents/actor.mjs), но у подставного
 * актора в тесте её может не быть, поэтому считаем сами.
 */
function sizeOf(actor) {
  const sys = actor?.system ?? {};
  if (sys.sizeTotal != null) return Number(sys.sizeTotal) || 0;
  return (Number(sys.size) || 0) + (Number(sys.sizeMod) || 0);
}

export const PREDICATES = {
  race:    (actor, ctx, value) => list(value).includes(actor?.system?.race),
  subrace: (actor, ctx, value) => list(value).includes(actor?.system?.subrace),

  sizeMax: (actor, ctx, value) => sizeOf(actor) <= Number(value),

  charMin: (actor, ctx, value) => Object.entries(value ?? {}).every(
    ([key, min]) => (Number(actor?.system?.characteristics?.[key]?.total) || 0) >= min),

  hasTalent: (actor, ctx, value) => hasNamed(actor, value),
  hasTrait:  (actor, ctx, value) => hasNamed(actor, value),

  weaponClass: (actor, ctx, value) => list(value).includes(ctx?.weapon?.system?.weaponClass),

  targetHasTrait: (actor, ctx, value) => hasNamed(ctx?.target, value)
};

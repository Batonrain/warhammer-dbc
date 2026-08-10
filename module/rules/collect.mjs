// module/rules/collect.mjs
//
// Отбор правил: matchRule решает по одному правилу, collectRules собирает всё,
// что даёт актор, и снимает вытесненные.

import { PREDICATES } from "./predicates.mjs";
import { getRuleSources } from "./sources.mjs";

const overridesOf = rule => (Array.isArray(rule?.overrides) ? rule.overrides : []);

/**
 * Подходит ли правило актору и контексту: истинны должны быть все условия
 * `when` сразу. Пустой `when` означает «всегда».
 *
 * Неизвестный ключ условия — ошибка в консоль и false: тихо не сработавшее
 * правило ищется днями.
 */
export function matchRule(rule, actor, ctx = {}) {
  for (const [key, value] of Object.entries(rule?.when ?? {})) {
    if (!Object.hasOwn(PREDICATES, key)) {
      console.error(`Warhammer DBC | правило «${rule?.id ?? "без id"}»: неизвестное условие «${key}»`);
      return false;
    }
    if (!PREDICATES[key](actor, ctx, value)) return false;
  }
  return true;
}

/**
 * Снятие вытесненных. Вызывается только после отбора по `when`: правило с
 * невыполненным условием ничего вытеснять не должно.
 *
 * Взаимное вытеснение — ошибка в данных. Оставляем оба и пишем в консоль: молча
 * выбрать одно из двух хуже, чем показать двойной эффект, который сразу заметят.
 */
function applyOverrides(rules) {
  const byId = new Map(rules.filter(r => r?.id).map(r => [r.id, r]));

  const mutual = new Set();
  for (const rule of rules) {
    for (const id of overridesOf(rule)) {
      if (!overridesOf(byId.get(id)).includes(rule.id)) continue;
      mutual.add(rule.id);
      mutual.add(id);
      if (rule.id <= id) console.error(`Warhammer DBC | правила «${rule.id}» и «${id}» вытесняют друг друга`);
    }
  }

  const dropped = new Set();
  for (const rule of rules) {
    for (const id of overridesOf(rule)) {
      if (byId.has(id) && !mutual.has(id)) dropped.add(id);
    }
  }

  return rules.filter(rule => !dropped.has(rule.id));
}

/**
 * Сбор без отбора: всё, что дают зарегистрированные источники. Отдельно от
 * отбора, потому что конвейер теста (rules/resolve-test.mjs, фаза 2) даёт
 * сторонним модулям дописать правила в этот список до того, как он просеян.
 *
 * Упавший источник не роняет сборку: ошибка в консоль, остальные отрабатывают.
 */
export function gatherRules(actor, ctx = {}) {
  const all = [];
  for (const [key, source] of getRuleSources()) {
    try {
      all.push(...(source(actor, ctx) ?? []));
    } catch (err) {
      console.error(`Warhammer DBC | источник правил «${key}» упал`, err);
    }
  }
  return all;
}

/** Отбор: сначала по `when`, и только потом снятие вытесненных. */
export function selectRules(rules, actor, ctx = {}) {
  return applyOverrides(rules.filter(rule => matchRule(rule, actor, ctx)));
}

/**
 * Все правила, действующие для актора в этом контексте: сначала собрать от всех
 * источников, потом отобрать по `when`, и только потом снять вытесненные.
 */
export function collectRules(actor, ctx = {}) {
  return selectRules(gatherRules(actor, ctx), actor, ctx);
}

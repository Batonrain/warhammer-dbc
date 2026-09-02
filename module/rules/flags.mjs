// module/rules/flags.mjs
//
// Запрос возможностей к реестру правил. Код спрашивает не «какая у актора раса»,
// а «умеет ли он это»: `hasRuleFlag(actor, "healing.astartes")` вместо
// `actor.system.race === "astartes"`.
//
// Разница не в стиле. Проверка расы живёт в коде, и вторая раса с тем же
// свойством требует правки кода. Возможность выдаётся правилом, то есть данными,
// и та же строка достаётся любой расе, у которой книга это свойство описывает:
// Арлекин «лечится как космодесантник» получит `healing.astartes` из своих
// данных, когда переедет на правила.
//
// Имя возможности лежит в поле `target` эффекта `grantFlag` — так же, как имя
// производного поля у `grantValue` (docs/rules-format.md).

import { collectRules } from "./collect.mjs";

const nameOf = v => String(v ?? "").trim();

/** Все возможности актора в этом контексте броска. */
export function ruleFlags(actor, ctx = {}) {
  const flags = new Set();
  for (const rule of collectRules(actor, ctx)) {
    for (const effect of rule?.effects ?? []) {
      if (effect?.kind !== "grantFlag") continue;
      const name = nameOf(effect.target);
      if (name) flags.add(name);
    }
  }
  return flags;
}

/** Есть ли у актора возможность с таким именем. */
export function hasRuleFlag(actor, flag, ctx = {}) {
  const name = nameOf(flag);
  return !!name && ruleFlags(actor, ctx).has(name);
}

/**
 * Подписи правил, давших эту возможность. Нужны интерфейсу: игрок должен
 * видеть, ЧТО именно погасило модификатор или откуда взялась кнопка, а не
 * получать безымянное «нельзя». Правило без `label` называется своим `id` —
 * пустая подпись хуже некрасивой.
 */
export function ruleFlagLabels(actor, flag, ctx = {}) {
  const name = nameOf(flag);
  if (!name) return [];
  return collectRules(actor, ctx)
    .filter(rule => (rule?.effects ?? []).some(
      e => e?.kind === "grantFlag" && nameOf(e.target) === name))
    .map(rule => rule.label || rule.id)
    .filter(Boolean);
}

/**
 * Цена в пуле (wdbc-1dc8, module/combat/capability-cost.mjs) у первой
 * найденной записи, давшей эту возможность — null, если возможность
 * бесплатна. Несколько источников одного имени с разной ценой — редкий
 * край, решается первым найденным (тот же компромисс, что у CAPABILITIES[key]
 * .label — общий для всех источников одного имени).
 */
export function ruleFlagCost(actor, flag, ctx = {}) {
  const name = nameOf(flag);
  if (!name) return null;
  for (const rule of collectRules(actor, ctx)) {
    for (const effect of rule?.effects ?? []) {
      if (effect?.kind === "grantFlag" && nameOf(effect.target) === name && effect.cost) return effect.cost;
    }
  }
  return null;
}

/**
 * Активные kind:"script" способности актора с ценой/частотой (wdbc-suwp) —
 * координаты (itemId/groupId/entryId/label) для панели «ВОЗМОЖНОСТИ СЕЙЧАС»,
 * тот же источник (collectRules → module/rules/item-rules.mjs), что у
 * ruleFlags выше, просто другой effect.kind. Пустой список — у актора нет
 * ни одной такой записи, панели нечего показывать (не ошибка).
 */
export function scriptAbilities(actor, ctx = {}) {
  const out = [];
  for (const rule of collectRules(actor, ctx)) {
    for (const effect of rule?.effects ?? []) {
      if (effect?.kind === "scriptAbility") out.push({ ruleId: rule.id, ruleLabel: rule.label, ...effect });
    }
  }
  return out;
}

// module/rules/fleshmetal.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Плотеметалл / Fleshmetal (Талант Механикума, Sahara 3-cc96 п.8; DoomBC —
//  Основная книга): «Несмотря на Трейт Machine, персонаж может лечиться как
//  органическое существо, получать эффекты Биомантии, есть, использовать
//  лекарства/наркотики. Эффект Haywire, который должен Оглушить/Парализовать
//  его, вместо этого лишь отнимает одно полудействие. Побочно: оружие со
//  свойством Sanctified игнорирует AP от Трейта Machine.»
//
//  Три переопределения Machine — что из них считает система:
//   • Haywire — таблица ЭМИ (combat/damage.mjs::_applyHaywire) только подсказывает
//     эффекты ГМу, поэтому у носителя Плотеметалла Оглушение/Беспомощность Машины
//     в подсказке заменяются потерей одного полудействия (fleshmetalHaywireText);
//   • Sanctified — AP от Трейта Machine (рейтинг × все участки) вычитается из
//     Поглощения брони при попадании освящённым оружием (fleshmetalMachineApCut);
//   • лечение, еда, Биомантия, лекарства — Трейт Machine в системе их НЕ
//     запрещает (ограничение «лечится только ремонтом» живёт текстом Трейта),
//     так что снимать нечего: для носителя Плотеметалла всё и так разрешено.
//
//  Чистый модуль без Foundry; зовёт combat/damage.mjs.
// ════════════════════════════════════════════════════════════════════════════

import { itemHasName } from "./predicates.mjs";

export const hasFleshmetal = actor =>
  [...(actor?.items ?? [])].some(i => i?.type === "talent"
    && (itemHasName(i, "Fleshmetal") || itemHasName(i, "Плотеметалл")));

const isMachine = i => i?.type === "trait"
  && (itemHasName(i, "Machine") || itemHasName(i, "Машина") || String(i.name ?? "").startsWith("Machine / Машина"));

/** Суммарный рейтинг Трейтов Machine — столько AP они дают на каждый участок. */
export function machineApOf(actor) {
  return [...(actor?.items ?? [])].filter(isMachine)
    .reduce((s, i) => s + Math.max(0, Number(i.system?.rating) || 0), 0);
}

/**
 * Сколько AP от Machine снять при попадании освящённым оружием по носителю
 * Плотеметалла. 0 — оружие не Sanctified, Таланта нет или Machine нет.
 */
export function fleshmetalMachineApCut(actor, { sanctified = false } = {}) {
  if (!sanctified || !hasFleshmetal(actor)) return 0;
  return machineApOf(actor);
}

/**
 * Подсказка таблицы ЭМИ для носителя Плотеметалла: Оглушение («Машины Оглушены»)
 * и Беспомощность («Машины Беспомощны») заменяются потерей одного полудействия.
 * Строки без таких эффектов (бросок до «Слабого нарушения») остаются как есть.
 */
export function fleshmetalHaywireText(text) {
  const note = "Плотеметалл: вместо этого носитель лишь теряет одно полудействие.";
  const src = String(text);
  const replaced = src
    .replace("Машины Оглушены, пока не покинут поле.", note)
    .replace("Машины Беспомощны.", note);
  // «Как Мёртвая Зона…» (длительная зона и ЭМИ Шторм) тянет Беспомощность по ссылке.
  if (replaced === src && src.includes("Мёртвая Зона")) return `${src} ${note}`;
  return replaced;
}

// module/rules/leadership-talents.mjs
// ════════════════════════════════════════════════════════════════════════════
//  ТАЛАНТЫ ЛИДЕРСТВА (глава 3) — Rancor / Злопамятность.
//
//  Sahara 3-ac78 (разведка 18.10.2026) описала всю группу как «ждёт
//  неисследованной подсистемы Команд/Слаженности» — повторная разведка
//  19.10.2026 нашла эту подсистему полностью реализованной (rules/command.mjs,
//  combat/command-state.mjs, rules/command-effects.mjs, rules/squad.mjs).
//  Rancor — единственный из 19, который подключается прямым расширением уже
//  работающей инфраструктуры целей Ненависти (rules/hatred.mjs,
//  rules/talent-targets.mjs), а не ждёт новой механики.
//
//  Книжный текст (packs-src, benefit): «Отдавая Команду против Ненавистных
//  врагов или на защиту от них, персонаж получает +10 на эту Команду и +1 к
//  максимуму Успехов от Риска.»
//
//  Реализовано из двух пунктов:
//   1. +10 на Команду — rollBonus, target "skill:command", тот же приём, что
//      hatred.mjs::hatredRules: ctx.targetActor сверяется с целями Ненависти
//      ЭТОГО ЖЕ актора (hatredTargetsOf) — Rancor без Hatred-целей молчит.
//   2. +1 к максимуму Успехов от Риска — riskCap не эффект броска
//      (resolve-test.mjs его не считает: это отдельный потолок Успехов
//      Команды, а не модификатор к Порогу), поэтому не правило реестра, а
//      чистая функция rancorRiskCapBonus — её зовёт sheets/squad-sheet.mjs
//      там же, где считает сам потолок (_effectiveRisk).
//
//  «Против Ненавистных... или на защиту от них» — направление (атака/защита)
//  система не разбирает ни у одного Talent с целями (та же честная граница,
//  что у Ненависти самой), поэтому проверяется только совпадение цели.
//
//  ctx.targetActor Команды — выделенный на сцене токен в момент броска, тем
//  же приёмом, что Тест Страха (sheets/tabs/disorders.mjs::openFearDialog):
//  книга не привязывает Команду к конкретному токену жёстко, но если цель
//  выделена — читается. Без выделенной цели оба пункта молчат.
// ════════════════════════════════════════════════════════════════════════════

import { itemHasName, hatredTargetsOf } from "./predicates.mjs";
import { anyTargetMatches } from "./talent-targets.mjs";

const RANCOR_NAMES = ["Rancor", "Злопамятность"];

/** Есть ли у актора Талант Rancor/Злопамятность. */
export function hasRancor(actor) {
  return [...(actor?.items ?? [])].some(i =>
    i?.type === "talent" && RANCOR_NAMES.some(n => itemHasName(i, n)));
}

/** Цель ЭТОГО броска совпала хоть с одной целью Ненависти актора. */
function rancorTargetMatches(actor, ctx) {
  const targets = hatredTargetsOf(actor);
  return targets.length > 0 && anyTargetMatches(targets, ctx);
}

/** +1 к максимуму Успехов Команды от Риска — sheets/squad-sheet.mjs::_effectiveRisk. */
export function rancorRiskCapBonus(actor, ctx = {}) {
  return hasRancor(actor) && rancorTargetMatches(actor, ctx) ? 1 : 0;
}

/**
 * Правила Талантов Лидерства для сборки тестов (rules/sources.mjs). Пусто,
 * если у актора нет Rancor или цель броска не совпала с целью Ненависти.
 */
export function leadershipTalentRules(actor, ctx = {}) {
  if (!hasRancor(actor) || !rancorTargetMatches(actor, ctx)) return [];
  return [{
    id: "rancor.command", label: "Злопамятность: Команда против Ненавистной цели",
    when: {},
    effects: [{ kind: "rollBonus", target: "skill:command", value: 10, label: "Злопамятность" }]
  }];
}

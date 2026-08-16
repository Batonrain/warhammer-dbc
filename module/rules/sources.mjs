// module/rules/sources.mjs
//
// Реестр источников правил. Источник — функция (actor, ctx) => массив правил.
// Добавить книгу означает зарегистрировать источник и положить данные; ядро при
// этом не меняется.

import { ASTARTES_RULES } from "./library/astartes.mjs";
import { HOMEWORLD_BY_KEY } from "../constants/homeworlds.mjs";
import { isFeatureEnabled } from "../constants/features.mjs";
import { CORE_RULES } from "./library/core.mjs";

const SOURCES = new Map();

export function registerRuleSource(key, fn) {
  SOURCES.set(key, fn);
}

export function getRuleSources() {
  return [...SOURCES.entries()];
}

/** Очистка реестра. Нужна тестам, чтобы подставить свои источники. */
export function clearRuleSources() {
  SOURCES.clear();
}

/**
 * Ключ Происхождения лежит на предмете-носителе, а не в system актора. Тип
 * предмета и ключ подсистемы в коде остались прежними («homeworld»,
 * «homeworlds»), в интерфейсе подсистема называется «Происхождения».
 */
const hwKey = actor =>
  [...(actor?.items ?? [])].find(i => i?.type === "homeworld")?.system?.key ?? "";

// Правила основной книги приходят каждому актору: они не привязаны ни к расе,
// ни к Происхождению, а отбираются по условию `when`. Так живёт «Проворный» —
// Черта нескольких рас, штраф от которой достаётся не носителю, а атакующему.
registerRuleSource("core", () => CORE_RULES);

// Машинная часть расовых Черт остаётся кодом (этап 3 плана): в данные уехало
// описание расы, а не её правила.
const RACE_RULES = { astartes: ASTARTES_RULES };

registerRuleSource("race", a => RACE_RULES[a?.system?.race] ?? []);

// Выключенная подсистема убирает свои правила из сборки: иначе выключатель
// «Происхождения» гасил бы галочки в диалоге броска, а правила Происхождения
// продолжали действовать. Вне Foundry isFeatureEnabled отдаёт значение по
// умолчанию, поэтому реестр по-прежнему запускается в тестах.
registerRuleSource("homeworld", a =>
  isFeatureEnabled("homeworlds") ? (HOMEWORLD_BY_KEY[hwKey(a)]?.rules ?? []) : []);

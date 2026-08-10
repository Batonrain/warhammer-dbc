// module/rules/sources.mjs
//
// Реестр источников правил. Источник — функция (actor, ctx) => массив правил.
// Добавить книгу означает зарегистрировать источник и положить данные; ядро при
// этом не меняется.

import { RACES } from "../constants/races.mjs";
import { HOMEWORLD_BY_KEY } from "../constants/homeworlds.mjs";

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

// Поле `rules` у данных расы и Происхождения пока не заполнено — источники
// вернут пустой массив. Заполнение идёт на этапе 3 плана.
registerRuleSource("race",      a => RACES[a?.system?.race]?.rules ?? []);
registerRuleSource("homeworld", a => HOMEWORLD_BY_KEY[hwKey(a)]?.rules ?? []);

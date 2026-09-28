// module/rules/library/replicant.mjs
//
// Машинная часть Черт Репликанта, которую нельзя выразить записью Конструктора
// на самой Черте: у Конструктора нет вида «диапазон Критического Провала»
// (critRangeMod есть только в правилах библиотеки, docs/rules-format.md).
// Возможности (Ступор от Гипно-Шрамов, Алхимическое Чудовище, сыворотка…)
// выдаёт сама Черта записью «Возможность» — см. rules/replicant.mjs.
//
// Источник — раса (rules/sources.mjs, RACE_RULES.replicant); дополнительно
// условие hasTrait: сняли Черту с персонажа — снялся и сдвиг Предела.

export const REPLICANT_RULES = [
  {
    // «Репликант уменьшает Предел Критического Провала для всех тестов I на 10
    // (обычно до 86+)». «Тест I» — любой тест на Интеллекте: и сама
    // Характеристика, и Навыки на ней (basedon:int) — так же книга говорит
    // «тесты T» у Отравления (library/conditions.mjs).
    id: "replicant.hypnoScars.critRange",
    label: "Hypno-Scars / Гипно-Шрамы",
    when: { hasTrait: "Hypno-Scars" },
    effects: [{ kind: "critRangeMod", target: "basedon:int", side: "failure", value: 10 }]
  }
];

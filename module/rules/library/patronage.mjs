// module/rules/library/patronage.mjs
//
// Правила по Покровительству Бога (system.patronGod) — по образцу RACE_RULES
// в rules/sources.mjs: массив правил на ключ Бога, а не разбросанные
// сравнения patronGod==='...' по коду.

// ── Иммунитет к Грозному Воплю у посвящённых Слаанеш (wdbc-l07y) ────────────
// Раньше зашито прямым сравнением system.patronGod==='slaanesh' в
// module/combat/dread-wail.mjs (фильтр целей звуковой волны).
export const SLAANESH_RULES = [
  { id: "slaanesh.dreadWail.immune", label: "Слаанеш: иммунитет к Грозному Воплю",
    effects: [{ kind: "grantFlag", target: "dreadWail.immune" }] }
];

export const PATRON_RULES = {
  slaanesh: SLAANESH_RULES
};

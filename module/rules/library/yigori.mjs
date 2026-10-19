// module/rules/library/yigori.mjs
//
// Правила Черт Йигори (корбук, глава I «Расы» — Йигори), которым нужен
// контекст броска и которые поэтому не выражаются записью Конструктора: у
// записи «Переброс» нет условия по цели теста (rules/item-rules.mjs даёт
// when:{}).
//
// Отбор — по Черте (hasTrait), а не по расе: Черту можно выдать и не-Йигори
// (Конструктор, ГМ), и правило должно ехать с ней, как едут её записи.

export const YIGORI_RULES = [
  {
    // «Раз в Раунд Йигори может перебросить любой тест, целью или источником
    // которого является Космодесантник. Йигори в одном Командном Присутствии и
    // в пределах видимости друг друга могут делиться этими перебросами».
    // limit — ограничитель «раз в Раунд» и обмена в стае: combat/angel-hunters.mjs
    // (rules/roll-mods.mjs::registerRerollLimiter), wdbc-erp61.
    id: "yigori.angelHunters",
    label: "Angel Hunters / Охотники на Ангелов",
    when: { hasTrait: "Angel Hunters", targetIsAstartes: true },
    effects: [{ kind: "rollMode", target: "all", mode: "keepBest", rolls: 2,
                limit: "angelHunters", label: "Охотники на Ангелов (раз в Раунд)" }]
  }
];

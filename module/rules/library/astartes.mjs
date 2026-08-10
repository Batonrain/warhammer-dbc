// module/rules/library/astartes.mjs
//
// Правила Астартес — эталон этапа 3 плана. Машинная часть расовых Черт из
// constants/races.mjs (ключ «astartes», поле traits) лежит здесь, текст
// `benefit` остаётся там: игрок читает описание, система применяет правила.
// Формат записи — docs/rules-format.md, инструкция — docs/how-to-add-race.md.
//
// Условие `when` у этих правил пустое: правила приходят от источника «race»
// (rules/sources.mjs), а он уже выбирает их по расе актора. Дублировать проверку
// в данных незачем — она бы разошлась с источником при первой правке.
//
// Две Черты машинной части не получили:
//
//   • Amphibious / Амфибия — переброс относится к специализации Athletics
//     (Плавание), а область эффекта различает только навык целиком
//     (`skill:athletics`). Более широкий переброс был бы не тем правилом.
//   • Nimble / Проворный — штраф достаётся тому, кто атакует Астартес, а атаки
//     переходят на конвейер теста только на шаге 5.2 плана.
//
// Обе остаются описанием в `benefit` до появления подходящей области эффекта.

export const ASTARTES_RULES = [
  {
    id: "astartes.size",
    label: "Size (1) / Размер (1)",
    effects: [{ kind: "grantValue", target: "sizeMod", value: 1 }]
  },
  {
    id: "astartes.unnatural.strength",
    label: "Unnatural Strength (4) / Сверхъестественная Сила (4)",
    effects: [{ kind: "charBonus", target: "s", value: 4 }]
  },
  {
    id: "astartes.unnatural.toughness",
    label: "Unnatural Toughness (4) / Сверхъестественная Стойкость (4)",
    effects: [{ kind: "charBonus", target: "t", value: 4 }]
  },
  {
    // Геносемя открывает импланты и таланты Геносемени. Условие в данных —
    // раса, как и в листе персонажа до этапа 3: сама Черта на акторе может быть
    // удалена вручную, а доступ к талантам от этого не менялся.
    id: "astartes.geneseed",
    label: "Gene-Seed / Геносемя",
    effects: [{ kind: "grantFlag", target: "talents.geneSeed" }]
  },
  {
    // Физиология Астартес — не Черта, а свойство расы из описания книги:
    // усиленный профиль безоружного удара (стр. 40) и лечение, при котором
    // Астартес всегда считается отдыхающим.
    id: "astartes.physiology",
    label: "Физиология Астартес",
    effects: [
      { kind: "grantFlag", target: "healing.astartes" },
      { kind: "grantFlag", target: "unarmed.astartesProfile" }
    ]
  }
];

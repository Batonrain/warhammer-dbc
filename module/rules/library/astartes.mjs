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
// Одна Черта машинной части не получила: Amphibious / Амфибия — переброс
// относится к специализации Athletics (Плавание), а область эффекта различает
// только навык целиком (`skill:athletics`). Более широкий переброс был бы не тем
// правилом, поэтому Черта остаётся описанием в `benefit`.
//
// Nimble / Проворный здесь тоже нет, но по другой причине: штраф от него
// достаётся не носителю, а тому, кто по нему бьёт, и такая же Черта есть у
// Азуриан, Друкхари и Кроорка. Правило одно на всех и живёт в
// [library/core.mjs](core.mjs), а отбирается по Черте у цели (шаг 5.2).

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
      { kind: "grantFlag", target: "unarmed.astartesProfile" },
      // Сложение под легионное оружие: своё берёт без штрафа, чужое — со
      // штрафом за тесную спусковую скобу (rules/legion-fit.mjs).
      { kind: "grantFlag", target: "weapons.legion" }
    ]
  }
];

// module/rules/library/beastman-shaman.mjs
//
// Hex-Marked Prey/Проклятая Метка (Талант, Шаман Зверолюдей, wdbc-xxb7):
// «Пока метка активна, все зверолюди-союзники получают +15 на атаки против
// этой цели.»
//
// Сам триггер (кнопка, встречный тест, метка) — module/combat/
// beastman-shaman.mjs::applyHexMarkedPrey, метка лежит на ЦЕЛИ
// (flags.warhammer-dbc.hexMarkedPrey={shamanUuid,god}). Здесь — только
// СЛЕДСТВИЕ метки: правило со статичным when, тем же образцом, что Avatar
// of Slaughter (rules/library/avatar-of-slaughter.mjs) — предикат читает
// флаг через ctx.targetActor (кто ЦЕЛЬ текущего теста Атаки), не сам actor.
// «Союзники-зверолюди» — раса effectiveRace(actor.system)==="beastman"
// (rules/race.mjs), не проверка disposition/фракции: predicates.mjs не
// имеет доступа к canvas/game, а раса — уже готовое чистое поле актора и
// точнее соответствует книжной формулировке, чем «любой союзник».
export const BEASTMAN_SHAMAN_RULES = [
  {
    id: "beastmanShaman.hexMarkedPrey.allyBonus",
    label: "Проклятая Метка: атака зверолюда по помеченной цели",
    when: { hexMarkedPreyAllyBonus: true },
    effects: [{ kind: "rollBonus", target: "attack", value: 15, label: "Проклятая Метка: цель помечена" }]
  }
];

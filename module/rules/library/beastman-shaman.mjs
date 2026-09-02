// module/rules/library/beastman-shaman.mjs
//
// Hex-Marked Prey/Проклятая Метка (Талант, Шаман Зверолюдей, wdbc-xxb7):
// «Пока метка активна, все зверолюди-союзники получают +15 на атаки против
// этой цели.» God-ответвления (Кхорн: Proven(3), Нургл: Toxic(1) на тех же
// попаданиях) добавлены wdbc-w8z4 — раньше были только текстом чат-карточки
// (module/combat/beastman-shaman.mjs::applyHexMarkedPrey), движок атаки не
// умел давать Особое Свойство Оружия из-за состояния ЦЕЛИ.
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
  },
  // God-ответвления: hexMarkedPreyAllyBonus принимает god строкой (wdbc-w8z4,
  // predicates.mjs) — тот же предикат, что у базового +15 выше, но проверяет
  // ещё и mark.god. Не отдельная проверка Покровительства актора: метка несёт
  // god ШАМАНА на момент наложения, а не текущее Покровительство союзника,
  // который бьёт — так задумано книгой («Кхорн даёт Кхорн-версию метки»).
  {
    id: "beastmanShaman.hexMarkedPrey.khorneProven",
    label: "Проклятая Метка (Кхорн): Proven(3) на атаке по цели",
    when: { hexMarkedPreyAllyBonus: "khorne" },
    effects: [{ kind: "grantWeaponProp", target: "attack", propKey: "proven", rating: 3 }]
  },
  {
    id: "beastmanShaman.hexMarkedPrey.nurgleToxic",
    label: "Проклятая Метка (Нургл): Toxic(1) на атаке по цели",
    when: { hexMarkedPreyAllyBonus: "nurgle" },
    effects: [{ kind: "grantWeaponProp", target: "attack", propKey: "toxic", rating: 1 }]
  }
];

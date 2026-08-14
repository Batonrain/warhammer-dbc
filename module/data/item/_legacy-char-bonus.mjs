// module/data/item/_legacy-char-bonus.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Общая миграция данных для типов, чья механика лежит в свободном
//  `system.effects`: Черта, Талант, Мутация, Имплант.
//
//  Одиночный бонус к Бонусу характеристики хранился двумя полями
//  (`charBonusStat` + `charBonusValue`), поздние предметы пишут тот же бонус
//  списком `charBonuses`. Два пути чтения тянулись через весь расчёт актора
//  (documents/actor.mjs) и через перенос в ActiveEffect
//  (constants/effect-keys.mjs) — миграция оставляет один, список.
//
//  Вынесено в общий файл, потому что типов четыре: четыре копии одного разбора
//  разъехались бы при первой же правке.
// ════════════════════════════════════════════════════════════════════════════

/** Сворачивает пару charBonusStat/charBonusValue в список charBonuses. */
export function migrateCharBonusPair(source) {
  const fx = source?.effects;
  if (fx && typeof fx === "object") {
    const { charBonusStat, charBonusValue } = fx;
    if (charBonusStat && charBonusValue) {
      fx.charBonuses = [...(fx.charBonuses ?? []), { stat: charBonusStat, value: charBonusValue }];
    }
    delete fx.charBonusStat;
    delete fx.charBonusValue;
  }
  return source;
}

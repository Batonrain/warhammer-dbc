// module/rules/hidden-threat.mjs
//
// Hidden Threat / Сокрытая Угроза (Дар Тзинч, wdbc-1rno.1): «Персонаж может
// потратить Очко Бесчестия, чтобы дать своей следующей атаке тип Незримое...
// Тесты пси-чутья или ноосферного сканирования на засекание такой атаки
// получают штраф −50».
//
// «Тип Незримое» — общий тип атаки из базовой книги (стр. 32), не изобретение
// этого Дара: полная буква правила («Уклонение недоступно, пока атака не
// засечена») — общий пробел системы для ВСЕХ Незримых атак (психосилы/
// Техно-чудеса тоже), заведён отдельно (wdbc-1rno.2). Здесь — только узкий
// срез под этот конкретный Дар: флаг «следующая атака этого актора —
// Незримая» + реактивная кнопка засечения с реальным тестом −50 в той же
// карточке, что Уклонение/Парирование (module/combat/attack-card.mjs,
// module/combat/hidden-threat.mjs). Результат детекта НЕ гейтит доступность
// Уклонения — честно оставлено вне этого объёма.

const FLAG_KEY = "hiddenThreatPending";

/** Следующая атака этого актора уже помечена «Незримой»? */
export function isHiddenThreatPending(actor) {
  return !!actor?.getFlag?.("warhammer-dbc", FLAG_KEY);
}

/** Пометить следующую атаку — вызывает script-кнопка после траты Очка Бесчестия. */
export async function markHiddenThreatPending(actor) {
  await actor.setFlag("warhammer-dbc", FLAG_KEY, true);
}

/**
 * Снять пометку — ровно один раз, когда атака действительно случилась
 * (module/combat/attack.mjs, при сборке карточки), независимо от того, была
 * ли она засечена: RAW даёт тип ОДНОЙ следующей атаке, не длящемуся эффекту.
 * @returns {boolean} была ли пометка снята (false — её и не было)
 */
export async function consumeHiddenThreatPending(actor) {
  if (!isHiddenThreatPending(actor)) return false;
  await actor.unsetFlag("warhammer-dbc", FLAG_KEY);
  return true;
}

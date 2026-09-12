// module/combat/devourer-of-time.mjs
// ════════════════════════════════════════════════════════════════════════
//  Devourer of Time / Пожиратель Времени (Тзинч, wdbc-1rno, d100 6…8):
//  «Когда чемпион застаёт хотя бы одного другого персонажа Врасплох, он
//  совершает свой первый Ход в бою два раза за Раунд: один в свою
//  инициативу и второй в конце инициативы. Все захваченные им Врасплох
//  персонажи теряют одно полудействие в свой второй Ход.» — «свой» здесь
//  про ХОД ОБЛАДАТЕЛЯ ДАРА (его повторный Ход), не про Ход самой жертвы
//  (подтверждено пользователем 12.09.2026, поправка к первому черновику).
//
//  «Застал Врасплох» книга не даёт числа/теста для автоопределения — в
//  системе это и так ручная галочка «Цель Врасплох» в окне атаки
//  (sheets/attack/mods.mjs), решает игрок за столом. Здесь по тому же
//  принципу: кнопка на предмете (packs-src, kind:"script"), не автодетект —
//  отдельного состояния «Врасплох» на Combatant в системе нет и не может
//  быть выведено из имеющихся данных.
//
//  Доп. Ход — существующий примитив combat/extra-turn.mjs (ещё один
//  Combatant того же актора), тот же, что у Last Actor/Последнего Актёра.
//  Выдаётся РОВНО ОДИН раз на бой (повторные захваты Врасплох добавляют
//  жертв в список, не плодят второй доп. Ход) и живёт до конца Combat
//  (Combatant, как и у Последнего Актёра, отдельно не снимается — Combat
//  удаляется целиком). «В конец инициативы» — Foundry сортирует Ходы по
//  убыванию инициативы, «конец» = минимум минус единица (endOfOrderInitiative).
//
//  Полудействие — реальный ОД (combat/action-economy.mjs::spendActionPoints,
//  1 ОД = полудействие, стр. 12). Списывается на жертвах КАЖДЫЙ раунд в
//  момент, когда начинается именно доп. Ход этой находки (hooks.mjs::
//  updateCombat, читает isDevourerOfTimeExtraTurn) — не одноразово: доп.
//  Ход сам повторяется каждый раунд (это простой второй Combatant в
//  порядке инициативы), значит и потеря повторяется вместе с ним до конца
//  боя, без отдельного счётчика раундов.
// ════════════════════════════════════════════════════════════════════════

export const DEVOURER_OF_TIME_CAPABILITY = "gift.tzeentch.devourerOfTime";
export const DEVOURER_OF_TIME_SOURCE = "devourerOfTime";
export const DEVOURER_OF_TIME_VICTIMS_FLAG = "devourerOfTimeVictims";

/**
 * Инициатива «в конец порядка» — Foundry сортирует Combatant по убыванию
 * инициативы (выше = раньше), значит «конец» — минимум текущих минус 1.
 * Нет ни одного числового значения (бой ещё не начал катать инициативу) —
 * 0 минус 1, чтобы доп. Ход всё равно оказался позже любого будущего 0.
 */
export function endOfOrderInitiative(combatants) {
  const list = Array.isArray(combatants) ? combatants : [...(combatants ?? [])];
  const values = list
    .map(c => c?.initiative)
    .filter(v => typeof v === "number" && Number.isFinite(v));
  return (values.length ? Math.min(...values) : 0) - 1;
}

/** Именно доп. Combatant этой находки (не обычный Ход того же актора). */
export function isDevourerOfTimeExtraTurn(combatant) {
  return combatant?.getFlag?.("warhammer-dbc", "extraTurnSource") === DEVOURER_OF_TIME_SOURCE;
}

/** Список Uuid жертв, накопленных на чемпионе за этот бой (без повторов). */
export function devourerOfTimeVictimUuids(actor) {
  const list = actor?.getFlag?.("warhammer-dbc", DEVOURER_OF_TIME_VICTIMS_FLAG);
  return Array.isArray(list) ? list : [];
}

/** Уникальное объединение уже записанных жертв с новыми Uuid — чистая функция для кнопки и теста. */
export function mergedVictimUuids(existing, added) {
  return [...new Set([...(Array.isArray(existing) ? existing : []), ...(Array.isArray(added) ? added : [])])];
}

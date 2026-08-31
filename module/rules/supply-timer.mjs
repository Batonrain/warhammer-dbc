// module/rules/supply-timer.mjs
// ═══════════════════════════════════════════════════════════════════════════
//  Общий примитив «расходуемый по игровому времени ресурс на предмете»
//  (wdbc-jtqf) — по образцу worldTimeRemaining (module/rules/cooldown.mjs),
//  но с ДРУГОЙ семантикой: cooldown.mjs отвечает «когда снова МОЖНО»
//  (повторно используемая перезарядка), этот модуль — «сколько ЕЩЁ осталось»
//  ОДНОРАЗОВОГО запаса, который тратится непрерывно, пока таймер запущен, и
//  не восстанавливается сам по истечении интервала — только явным refill.
//
//  Хранимое — ОДИН момент старта (flags.warhammer-dbc.<flag> = worldTime),
//  не тикающий счётчик: тот же приём экономии round-trip'ов, что и у
//  markWorldTimeCooldownUsed — «сколько осталось» всегда считается на
//  чтении по разнице с текущим game.time.worldTime, ничего не декрементируется
//  активным хуком.
//
//  Первый и пока единственный потребитель — module/rules/void-air.mjs
//  (запас воздуха свойства брони Void). Общий модуль заведён по прямой
//  просьбе пользователя — заранее, до второго потребителя — поэтому
//  умышленно minimal: только запуск/остановка/остаток, ничего Void-
//  специфичного здесь нет.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Остаток запаса в секундах — чистая функция, ничего не читает сама.
 * startedAt == null → таймер не запущен, весь запас ещё цел (totalSeconds).
 * totalSeconds === Infinity → безлимитный запас, всегда Infinity.
 * @param {number|null} startedAt     worldTime момента запуска, или null
 * @param {number} worldTime          текущий game.time.worldTime
 * @param {number} totalSeconds       полная ёмкость запаса в секундах
 * @returns {number} секунд осталось, не ниже 0
 */
export function supplyRemaining(startedAt, worldTime, totalSeconds) {
  const total = Number(totalSeconds);
  if (total === Infinity) return Infinity;
  if (startedAt == null) return Math.max(0, total || 0);
  const elapsed = Number(worldTime) - Number(startedAt);
  const remaining = (total || 0) - elapsed;
  return remaining > 0 ? remaining : 0;
}

/** Запущен ли таймер прямо сейчас (флаг документа несёт момент старта). */
export function isSupplyStarted(doc, flag) {
  return doc?.getFlag?.("warhammer-dbc", flag) != null;
}

/** Момент старта таймера документа, или null. */
export function supplyStartedAt(doc, flag) {
  const v = doc?.getFlag?.("warhammer-dbc", flag);
  return v == null ? null : Number(v);
}

/** Запустить таймер на текущий момент — уже запущенный НЕ перезапускает (не теряет накопленный расход). */
export async function startSupplyTimer(doc, flag) {
  if (!doc || isSupplyStarted(doc, flag)) return;
  await doc.setFlag("warhammer-dbc", flag, game.time.worldTime);
}

/** Остановить таймер (снять флаг) — использовать и для «закончился воздух», и для явного refill (полный запас). */
export async function stopSupplyTimer(doc, flag) {
  if (!doc || !isSupplyStarted(doc, flag)) return;
  await doc.unsetFlag("warhammer-dbc", flag);
}

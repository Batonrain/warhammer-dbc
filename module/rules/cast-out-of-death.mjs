// module/rules/cast-out-of-death.mjs
// ════════════════════════════════════════════════════════════════════════
//  Cast Out of Death / Изгнанный из Смерти (Нургл, wdbc-1rno, d100 34…36):
//  «Персонаж не может умереть от Критического Эффекта... после ЛЮБОГО
//  Критического Эффекта, что уничтожает или повреждает части его тела, все
//  повреждения регенерируют обратно к минимально функциональному состоянию
//  (поднимая его Раны до −7, если они были ниже) в течение 7 ч. после
//  ранения. Этот дар не действует против варп-оружия, Выжигания Души и
//  подобных атак, что уничтожают саму душу.»
//
//  Такт регенерации — тот же worldTime/«Календарь», что уже даёт
//  rules/fleshmetal-regen.mjs (Hooks.on("updateWorldTime"), hooks.mjs) —
//  форма другая: не трикл +1/час без потолка, а ОДНОРАЗОВЫЙ дедлайн от
//  МОМЕНТА конкретного Критического Эффекта. Хранится один флаг-дедлайн
//  (не тикающий счётчик), тот же приём, что rules/cooldown.mjs/rules/
//  supply-timer.mjs. Новый Критический Эффект СДВИГАЕТ дедлайн на 7ч от
//  СЕБЯ, не складывает со старым — «7 часов после [последнего] ранения»,
//  не «7 часов на каждое ранение по очереди».
//
//  «Раны до −7» в терминах этой системы (rules/wound-tier.mjs,
//  system.wounds.value/critical, разделены — критические считаются ОТ 0
//  вниз отдельным счётчиком) — это value:0, critical:7 (суммарно «−7»),
//  срабатывает, только если текущий суммарный уровень НИЖЕ −7 (иначе
//  регенерация подняла бы Раны персонажу, который и так жив-здоров, что
//  книга не говорит).
//
//  «Не действует против варп-оружия/Выжигания Души» — оба исключения уже
//  различимы кодом БЕЗ новой разметки: варп-оружие — существующий параметр
//  warpSoak (combat/damage.mjs), Выжигание Души вообще не проходит через
//  applyDamageToActor (см. заголовок combat/damage.mjs, идёт мимо через
//  hooks.mjs::_executeSoulBurn) — сюда вызывающая сторона (damage.mjs)
//  просто не должна звать schedule/suppress при warpSoak.
//
//  Чистый модуль: ни одного обращения к Foundry, всё приходит аргументами.
// ════════════════════════════════════════════════════════════════════════

/** Имя возможности; выдаётся Механикой предмета «Cast Out of Death». */
export const CAST_OUT_OF_DEATH_CAPABILITY = "gift.nurgle.castOutOfDeath";

/** Флаг с дедлайном (worldTime) регенерации. */
export const CAST_OUT_OF_DEATH_FLAG = "castOutOfDeathDeadline";

/** Порог книги — «Раны до −7». */
export const REGEN_FLOOR = -7;

const HOUR = 3600;

/** Новый дедлайн — 7 игровых часов от ЭТОГО момента (ставится/сдвигается при каждом Критическом Эффекте). */
export function scheduleCastOutOfDeathRegen(worldTime) {
  return Number(worldTime) + 7 * HOUR;
}

/**
 * Суммарный уровень Ран в единой шкале книги: положительные Раны как есть,
 * а Критические (system.wounds.critical > 0, «Раны в минусе») — отрицательным
 * числом. 5 Критических читается как «−5».
 */
export function totalWoundsLevel(system) {
  const value = Number(system?.wounds?.value) || 0;
  const critical = Number(system?.wounds?.critical) || 0;
  if (value > 0) return value;
  return critical > 0 ? -critical : 0; // избегаем -0 (Object.is(-0, 0) === false)
}

/**
 * План регенерации на этом тике worldTime — null, если применять нечего:
 * дедлайна нет, он ещё не наступил, или Раны и так не ниже −7 (незачем
 * поднимать персонажа, который и не падал так низко).
 *
 * @param {object} system   actor.system
 * @param {?number} deadline flags.warhammer-dbc.castOutOfDeathDeadline
 * @param {number} worldTime текущее игровое время
 * @returns {?{update: object}} update — кусок для actor.update() (может
 *   быть пустым объектом, если регенерировать физически нечего — дедлайн
 *   всё равно гасится вызывающей стороной)
 */
export function planCastOutOfDeathRegen(system, deadline, worldTime) {
  if (deadline == null) return null;
  if (Number(worldTime) < Number(deadline)) return null;
  if (totalWoundsLevel(system) >= REGEN_FLOOR) return { update: {} };
  return { update: { "system.wounds.value": 0, "system.wounds.critical": -REGEN_FLOOR } };
}

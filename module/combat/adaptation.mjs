// module/combat/adaptation.mjs
//
// Панцирь, субмутация 10 «Адаптация» (wdbc-q0q8): «Мутация никак не
// проявляется обычно, но когда персонаж подвергается успешной атаке (до
// Избеганий и урона), он получает +1 к Поглощению вида урона этой атаки до
// конца боя или сцены, до максимума в Cor.b.»
//
// Дословный триггер («до Избеганий») здесь не воспроизвести точно: Уклонение/
// Парирование гасит попадания очереди «по одному за степень успеха» (одна
// защита — сразу несколько попаданий, без привязки к типу/подвиду каждого),
// и без риска задвоить/пропустить счёт единственная надёжная точка —
// «Применить урон» (тот же приём, что у Ртути/Наслаждения рядом в
// damage.mjs): непоглощённый урон, тип/подвид уже известны и это ровно одно
// попадание. Отличие от буквы книги — если персонаж полностью увернулся,
// бонус не капнет.
//
// Ключ карты — тот же формат, что absorptionTarget записи Конструктора
// «AP против типа/подвида урона» (apps/mechanics.mjs, wdbc-q0q8): "vsType:X"
// или "vsSubtype:X". Читается НАПРЯМУЮ в module/combat/damage.mjs (не через
// rules/character/armour.mjs/prepareDerivedData, как обычные vsType/vsSubtype
// брони) — накопленный за этот же бой бонус обязан действовать на СЛЕДУЮЩЕЕ
// же попадание без ожидания отдельного пересчёта листа. Состояние — флаг
// актора (не поле схемы), живёт «до конца боя», как и другие подобные метки
// этого файла.

const FLAG = "adaptationAbsorption";
export const ADAPTATION_CAPABILITY = "mutation.carapace.adaptation";

/** Ключ карты для данного попадания: подвид, если он есть, иначе широкий тип. */
function targetKey(damageType, damageSubtype) {
  return damageSubtype ? `vsSubtype:${damageSubtype}` : `vsType:${damageType}`;
}

/** Текущая накопленная карта бонусов Адаптации данного актора. */
export function adaptationBonuses(actor) {
  return actor?.getFlag?.("warhammer-dbc", FLAG) || {};
}

/** Накопленный бонус именно для этого типа/подвида — 0, если ничего не накоплено. */
export function adaptationBonusFor(actor, damageType, damageSubtype) {
  return Number(adaptationBonuses(actor)[targetKey(damageType, damageSubtype)]) || 0;
}

/**
 * Отметить попадание: +1 к бонусу этого типа/подвида, до потолка Cor.b.
 * Каждое отдельное попадание прибавляет ещё +1 (книга не ограничивает
 * срабатывание одним разом за бой) — ограничен только сам потолок, и он свой
 * у каждого вида урона по отдельности (это разные ключи карты).
 */
export async function maybeGrantAdaptationBonus(actor, hasReactionFlag, damageType, damageSubtype) {
  if (!hasReactionFlag) return;
  const cap = Number(actor.system?.corruptionBonus) || 0;
  if (cap <= 0) return;
  const key = targetKey(damageType, damageSubtype);
  const marks = adaptationBonuses(actor);
  const current = Number(marks[key]) || 0;
  if (current >= cap) return;
  await actor.setFlag("warhammer-dbc", FLAG, { ...marks, [key]: current + 1 });
}

/** Бой кончился — накопленные бонусы Адаптации снимаются со всех комбатантов. */
export async function clearAdaptationBonuses(combat) {
  for (const combatant of combat?.combatants ?? []) {
    const actor = combatant.actor;
    if (actor?.getFlag?.("warhammer-dbc", FLAG)) await actor.unsetFlag("warhammer-dbc", FLAG);
  }
}

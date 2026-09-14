// module/combat/mercury-reaction.mjs
//
// Замена Крови, субмутация 2 «Ртуть» (wdbc-q0q8): «зеркальная жидкость
// растекается от раны, что даёт раненной части тела иммунитет к E(Ls) урону,
// но делает её броню электропроводящей до конца сцены или боя». Триггер —
// «непоглощённый I, R или X урон» (текст мутации целиком, не только этой
// субмутации): та же проверка netDamage > 0, что у Наслаждения/Заражения
// Нурглингами рядом в damage.mjs, просто с гейтом по damageType.
//
// Состояние — флаг актора, не поле схемы: живёт строго «до конца боя», как
// avatarOfSlaughterMark/turnStateShield и другие подобные метки этого файла
// (module/combat/avatar-of-slaughter.mjs) — не постоянная часть листа.

const FLAG = "mercuryElectrifiedLocs";

/** Отмечена ли эта часть тела как «под Ртутью» — иммунна к E(Ls), но проводит ток. */
export function isMercuryElectrified(actor, armorKey) {
  return !!actor?.getFlag?.("warhammer-dbc", FLAG)?.[armorKey];
}

/**
 * Отметить часть тела, если непоглощённый урон подходящего типа и на акторе
 * есть Возможность субмутации (mutation.bloodReplacement.mercuryReaction,
 * выдаётся Конструктором Замены Крови только при субмутации «2» — см. пак).
 * Идемпотентно: повторное попадание в уже отмеченную часть ничего не пишет.
 */
export async function maybeMarkMercuryLocation(actor, hasReactionFlag, damageType, armorKey) {
  if (!hasReactionFlag) return;
  if (!["impact", "rending", "blast"].includes(damageType)) return;
  const marks = actor.getFlag("warhammer-dbc", FLAG) || {};
  if (marks[armorKey]) return;
  await actor.setFlag("warhammer-dbc", FLAG, { ...marks, [armorKey]: true });
}

/** Бой кончился — метки Ртути снимаются со всех комбатантов (та же логика «до конца боя»). */
export async function clearMercuryMarks(combat) {
  for (const combatant of combat?.combatants ?? []) {
    const actor = combatant.actor;
    if (actor?.getFlag?.("warhammer-dbc", FLAG)) await actor.unsetFlag("warhammer-dbc", FLAG);
  }
}

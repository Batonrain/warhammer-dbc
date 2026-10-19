// module/combat/armour-monger.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Armour-Monger / Бронник (Талант Стойкости, глава 3): «Персонаж увеличивает
//  AP своей брони на +2 на всех участках, пока ежедневно тратит час на её
//  чистку, ремонт или мелкую переделку.»
//
//  Тумблер «Броня обслужена сегодня» на вкладке БОЙ (только у носителя): час
//  работы с бронёй система не меряет, о нём игрок говорит нажатием. Метка —
//  флаг актора { day } (сутки Календаря, rules/resilience-talents.mjs); пока
//  она стоит, расчёт AP (rules/character.mjs) даёт +2 на каждом участке тем же
//  складываемым каналом, что надбавка эффектов. В полночь по Календарю
//  (game.time.worldTime кратно 86400) метка гаснет сама — часы Состояний
//  (combat/condition-clock.mjs); сам расчёт AP тоже сверяет сутки метки с
//  текущими, если часы не успели сработать.
// ════════════════════════════════════════════════════════════════════════════

import { hasResilienceTalent, ARMOUR_MONGER_FLAG, ARMOUR_MONGER_AP, armourMongerStamp,
         armourMongerActive, armourMongerExpired } from "../rules/resilience-talents.mjs";

const NS = "warhammer-dbc";

export function hasArmourMonger(actor) {
  return hasResilienceTalent(actor, "armourMonger");
}

const worldNow = () => Number(globalThis.game?.time?.worldTime) || 0;

/** Включена ли сейчас метка «броня обслужена сегодня». */
export function armourMongerOn(actor) {
  return armourMongerActive(actor, worldNow());
}

/** Переключить тумблер: поставить метку текущих суток или снять. */
export async function toggleArmourMonger(actor) {
  if (!hasArmourMonger(actor)) {
    return ui.notifications?.warn("Нужен Талант Armour-Monger/Бронник.");
  }
  if (armourMongerOn(actor)) {
    await actor.unsetFlag(NS, ARMOUR_MONGER_FLAG);
    ui.notifications?.info(`${actor.name}: броня не обслужена — бонус Бронника снят.`);
    return false;
  }
  await actor.setFlag(NS, ARMOUR_MONGER_FLAG, armourMongerStamp(worldNow()));
  ui.notifications?.info(`${actor.name}: броня обслужена — +${ARMOUR_MONGER_AP} AP на всех участках до полуночи.`);
  return true;
}

/**
 * При загрузке мира (ГМ): метка прошлых суток, оставшаяся с закрытия мира —
 * часы Календаря на загрузке не тикают, а расчёт AP при самой первой подготовке
 * актора ещё не знает времени мира (game.time не готов) и верит метке.
 */
export async function sweepStaleArmourMonger() {
  if (!globalThis.game?.user?.isGM) return;
  const to = worldNow();
  const actors = [...(game.actors ?? [])];
  const { unlinkedTokens } = await import("../migrations/unlinked-tokens.mjs");
  for (const { actor } of unlinkedTokens()) actors.push(actor);
  for (const actor of actors) {
    try { await armourMongerClock(actor, { to }); }
    catch (err) { console.warn(`warhammer-dbc | Бронник: сброс метки у «${actor?.name}»`, err); }
  }
}

/**
 * Часы Календаря (CONDITION_CLOCK_HANDLERS): метка прошлых суток снимается.
 * Откат Календаря назад метку не трогает (armourMongerExpired сверяет сутки на
 * равенство, а откат вернул бы метку в «сегодня» или в «завтра»; в последнем
 * случае она тоже считается просроченной и снимется — осознанно).
 */
export async function armourMongerClock(actor, { to } = {}) {
  const flag = actor?.getFlag?.(NS, ARMOUR_MONGER_FLAG);
  if (!flag || !armourMongerExpired(flag, to)) return;
  await actor.unsetFlag(NS, ARMOUR_MONGER_FLAG);
}

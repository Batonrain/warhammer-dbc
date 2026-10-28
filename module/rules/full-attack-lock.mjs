// module/rules/full-attack-lock.mjs
// ════════════════════════════════════════════════════════════════════════════
//  ЗАПРЕТ ФИЗИЧЕСКИХ ИЗБЕГАНИЙ ПОСЛЕ ПОЛНОЙ АТАКИ (Sahara riding-the-momentum;
//  решение владельца 24.10.2026: «включить»).
//
//  Книга (core, «Полная Атака»): «Персонаж делает рукопашный приём с бонусом
//  +30. До начала своего следующего Хода он не может совершать Физические
//  Избегания.» Физические Избегания — Уклонение и Парирование (в книге оба с
//  типом «Физическое, Реагирование, Избегание»); «Пси-капюшон» — Ментальное
//  Избегание, под запрет не попадает. Раньше система писала запрет в
//  подсказке Базы (constants/combat.mjs::MELEE_BASES.fullatk), но нигде его не
//  проверяла: Реакции спокойно уходили на Уклонение и Парирование.
//
//  Метка `fullAttackLock` ставится на атакующего при КАЖДОЙ рукопашной атаке с
//  Базой «Полная Атака» (независимо от попадания) и гаснет в начале его
//  следующего Хода (rules/turn-flags.mjs::TURN_SCOPED_FLAGS). Значение:
//    light       — все Полные Атаки этого Хода были кулаками и/или ножами
//                  («в любой комбинации» — ровно условие В Ногу с Моментом);
//    repriseOpen — после Яростного Штурма была успешная дополнительная атака
//                  (условие Реприза).
//
//  Смягчения:
//    • Riding the Momentum / В Ногу с Моментом (Разбойник): после Полной Атаки
//      кулаками или ножами МОЖНО Уклоняться со штрафом −10; Парирование — нет.
//    • Reprise / Реприз (Берсерк): после успешной дополнительной атаки Яростного
//      Штурма (даже отменённой Избеганием) можно тратить оставшиеся Реакции на
//      Парирование; Уклонение остаётся запрещённым.
//
//  Модуль чистый и НЕ импортируется из rules/sources.mjs (круга через
//  source-registry нет, AGENTS.md → «Источники правил»).
// ════════════════════════════════════════════════════════════════════════════

import { hasRogueTalent, isFistWeapon } from "./rogue-talents.mjs";
import { hasBerserkerTalent } from "./berserker-talents.mjs";
import { isKnifeWeapon } from "./unseen-talents.mjs";

export const FULL_ATTACK_LOCK_FLAG = "fullAttackLock";
/** Штраф Уклонения после Полной Атаки у носителя В Ногу с Моментом. */
export const RIDING_MOMENTUM_PENALTY = -10;

/** Кулаки или нож — оружие, после которого В Ногу с Моментом разрешает Уклонение. */
export const isLightFullAttackWeapon = weapon => isFistWeapon(weapon) || isKnifeWeapon(weapon);

const flagValue = (actor, key) => actor?.getFlag?.("warhammer-dbc", key) ?? actor?.flags?.["warhammer-dbc"]?.[key];

/** Текущая метка запрета (или null). */
export function fullAttackLockOf(actor) {
  const v = flagValue(actor, FULL_ATTACK_LOCK_FLAG);
  return v && typeof v === "object" ? v : null;
}

/**
 * Новое значение метки после очередной Полной Атаки этим оружием: «лёгкость»
 * сохраняется, только пока ВСЕ Полные Атаки Хода были кулаками/ножами.
 */
export function lockAfterFullAttack(prev, weapon) {
  return { light: (prev ? !!prev.light : true) && isLightFullAttackWeapon(weapon), repriseOpen: !!prev?.repriseOpen };
}

/** Новое значение метки после успешной дополнительной атаки Яростного Штурма (если есть Реприз). */
export function lockAfterFuriousChild(prev, actor) {
  if (!prev || !hasBerserkerTalent(actor, "reprise")) return prev;
  return { ...prev, repriseOpen: true };
}

/**
 * Можно ли актору сейчас совершить Физическое Избегание.
 *
 * @param {object} actor
 * @param {"dodge"|"parry"} kind
 * @returns {{blocked:boolean, penalty:number, reason:string, note:string}}
 *   blocked — отказ (Реакция не тратится); penalty — поправка к порогу
 *   (−10 у В Ногу с Моментом); note — подпись смягчения для карточки.
 */
export function physicalAvoidanceVerdict(actor, kind, combatId = "") {
  const open = { blocked: false, penalty: 0, reason: "", note: "" };
  const lock = fullAttackLockOf(actor);
  if (!lock) return open;
  // Метка от ДРУГОГО боя (персонаж добил врага Полной Атакой, бой закончился, начался новый и Хода у него
  // ещё не было) устарела: «до начала следующего Хода» тот бой уже миновал.
  if (lock.combatId && combatId && lock.combatId !== combatId) return open;
  if (kind === "dodge" && lock.light && hasRogueTalent(actor, "ridingTheMomentum")) {
    return { ...open, penalty: RIDING_MOMENTUM_PENALTY, note: `В Ногу с Моментом ${RIDING_MOMENTUM_PENALTY}` };
  }
  if (kind === "parry" && lock.repriseOpen && hasBerserkerTalent(actor, "reprise")) {
    return { ...open, note: "Реприз" };
  }
  const label = kind === "parry" ? "Парирование" : "Уклонение";
  let hint = "";
  if (kind === "dodge" && hasRogueTalent(actor, "ridingTheMomentum"))
    hint = " В Ногу с Моментом не помогает: Полная Атака была не только кулаками и ножами.";
  else if (kind === "parry" && hasRogueTalent(actor, "ridingTheMomentum"))
    hint = " В Ногу с Моментом разрешает Уклонение, но не Парирование.";
  return {
    blocked: true, penalty: 0, note: "",
    reason: `${label} невозможно: после Полной Атаки до начала следующего Хода нельзя совершать Физические Избегания.${hint}`
  };
}

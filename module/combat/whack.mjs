// module/combat/whack.mjs
// ════════════════════════════════════════════════════════════════════════
//  ЗАТРЕЩИНА / Whack (Талант Пугилиста, стр. 62; задача Sahara 3-eddb,
//  решение владельца 24.10.2026).
//
//  «Он может совершать безоружные атаки руками, в которых он держит
//  одноручное рукопашное оружие (кроме оружия с Хватом П+Л). Противники,
//  которые еще не видели в этом бою как персонаж совершает подобный прием,
//  получают штраф –30 на Избегания от такой атаки (ГМ может потребовать тесты
//  Awareness ... для врагов кроме цели, чтобы определить, заметили ли они,
//  что в их поле зрения проводился этот прием).»
//
//  ЧТО АВТОМАТИЗИРОВАНО
//  • Первая половина (право бить рукой с оружием) системой не ограничивалась
//    никогда: Кулак занимает 0 рук (rules/hands.mjs, MELEE_GRIP_HANDS.Кист),
//    поэтому ударить им можно и с мечом в той же руке — гейта нет и не нужно.
//  • Что считать Затрещиной: безоружный удар кулаком (интегральная атака с
//    Хватом «Кист») носителя Таланта, у которого НЕТ свободной руки и в
//    руках есть одноручное рукопашное (не «2р», не «П+Л»). Если свободная рука
//    есть, игрок бьёт ею — это обычный удар, а не приём из чужой руки.
//  • Память «видел» — автоматическая (решение владельца вместо Awareness-
//    тестов ГМа): противник считается видевшим приём, если токен
//    Затрещинщика был в его поле зрения (дальность + сектор, БЕЗ стен —
//    rules/vision-target.mjs, приближение) в момент Затрещины; цель удара
//    записывается безусловно. Хранится флагом на самом Затрещинщике —
//    массивом id токенов — и сбрасывается при удалении боя (hooks.mjs →
//    clearWhackMemory), так же как память Страха «до конца сцены»
//    (combat/fear.mjs, FEAR_FACED_FLAG).
//  • −30 ложится на Уклонение И Парирование цели (книга: «Избегания»), только
//    первый раз для каждого противника.
//
//  ЧЕСТНЫЙ ПРЕДЕЛ: поле зрения считается приближённо и без стен. Кого видели
//  ВНЕ боя (до первого броска Инициативы) — память всё равно ведётся и
//  сбрасывается только с удалением боя; вне боя флаг живёт до следующего.
// ════════════════════════════════════════════════════════════════════════

import { hasPugilistTalent } from "../rules/pugilist-talents.mjs";
import { handsOccupied, currentMeleeGrip, weaponHandsRequired } from "../rules/hands.mjs";
import { isTokenInSight } from "../rules/vision-target.mjs";
import { isIntegralAttack } from "./equipped-melee.mjs";

const NS = "warhammer-dbc";

/** Флаг Затрещинщика: массив id токенов, которые уже видели приём. */
export const WHACK_SEEN_FLAG = "whackSeenBy";
/** «штраф –30 на Избегания». */
export const WHACK_EVASION_PENALTY = -30;

/** Безоружный удар кулаком («Кист»)? */
function isFistStrike(weapon) {
  return isIntegralAttack(weapon) && /Кист/.test(String(weapon?.system?.grips ?? ""));
}

/** Удерживаемое одноручное рукопашное оружие (не интегральное, не «2р», не «П+Л»). */
function isOneHandedMeleeInHand(item, actor) {
  if (item?.type !== "weapon" || item.system?.weaponClass !== "melee" || isIntegralAttack(item)) return false;
  if (weaponHandsRequired(item, actor) !== 1) return false;
  return currentMeleeGrip(item) !== "П+Л";
}

/** Это Затрещина: носитель Таланта бьёт кулаком, когда все его руки заняты и в одной из них одноручное рукопашное. */
export function isWhackStrike(actor, weapon) {
  if (!actor || !isFistStrike(weapon) || !hasPugilistTalent(actor, "whack")) return false;
  const hands = handsOccupied(actor);
  if (hands.free > 0) return false;
  return hands.items.some(i => isOneHandedMeleeInHand(i, actor));
}

const tokenIdOf = t => t?.document?.id ?? t?.id ?? null;

/**
 * Решение по этой атаке: { active, penalty, note }. Чистое — память только
 * читается (запись — recordWhackSeen, отдельно).
 */
export function whackStrike(actor, weapon, targetToken = null) {
  if (!isWhackStrike(actor, weapon)) return { active: false, penalty: 0, note: "" };
  const tid = tokenIdOf(targetToken);
  const seen = actor.getFlag?.(NS, WHACK_SEEN_FLAG);
  const first = !!tid && !(Array.isArray(seen) && seen.includes(tid));
  return first
    ? { active: true, penalty: WHACK_EVASION_PENALTY,
        note: `👊 Затрещина: цель ещё не видела этот приём в бою — её Уклонение и Парирование ${WHACK_EVASION_PENALTY}.` }
    : { active: true, penalty: 0,
        note: tid ? "👊 Затрещина: цель уже видела этот приём в бою — штрафа к Избеганию нет." : "" };
}

/**
 * Запомнить, кто видел Затрещину: цель — безусловно; из остальных токенов
 * сцены — противники атакующего (иная disposition), у которых его токен в
 * поле зрения.
 */
export async function recordWhackSeen(actor, attackerToken, targetToken = null) {
  if (!actor?.setFlag) return;
  const seen = new Set(actor.getFlag?.(NS, WHACK_SEEN_FLAG) ?? []);
  const tid = tokenIdOf(targetToken);
  if (tid) seen.add(tid);
  const atkDoc = attackerToken?.document ?? attackerToken;
  const scene = globalThis.canvas?.scene;
  const grid = scene?.grid ?? { size: globalThis.canvas?.grid?.size || 100, distance: 1 };
  if (atkDoc && scene?.tokens) {
    for (const t of scene.tokens) {
      const doc = t?.document ?? t;
      if (!doc || doc.id === atkDoc.id) continue;
      if (doc.disposition === atkDoc.disposition) continue; // «противники»
      if (isTokenInSight(doc, atkDoc, grid)) seen.add(doc.id);
    }
  }
  await actor.setFlag(NS, WHACK_SEEN_FLAG, [...seen]);
}

/** Конец боя: бойцы забывают, кто видел их Затрещину. */
export async function clearWhackMemory(combat) {
  const actors = new Set();
  for (const c of combat?.combatants ?? []) if (c?.actor) actors.add(c.actor);
  for (const t of globalThis.canvas?.scene?.tokens ?? []) if (t?.actor) actors.add(t.actor);
  for (const a of actors) {
    if (a?.getFlag?.(NS, WHACK_SEEN_FLAG) !== undefined) await a.unsetFlag?.(NS, WHACK_SEEN_FLAG);
  }
}

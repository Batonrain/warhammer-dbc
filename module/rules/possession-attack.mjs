// module/rules/possession-attack.mjs
// ════════════════════════════════════════════════════════════════════════
//  АТАКА ОДЕРЖИМОСТЬЮ (Трейт «Possession / Одержимость», core.json; wdbc-q267).
//
//  Книга: «Чтобы начать Одержимость, персонаж должен находиться не далее W.b м
//  от нее… Атака Одержимостью является расширенным действием, требующим тест
//  на W+0 vs W+0 в конце каждого Хода атакующего. Когда атакующий суммарно
//  побеждает 5 Успехов на этом тесте, он успешно вселяется в жертву, но если
//  жертва побеждает на 5 Успехов, сила ее воли отталкивает атакующего – он не
//  может пытаться вселиться в нее в течение 24 часов и получает 1d10
//  непоглощаемого E Dmg в торс. Если у атакующего есть Трейт Unnatural W, но у
//  жертвы нет, правило форсированной «ничьей» при проигрыше атакующего не
//  применяется.»
//  Вселившись: «Одержимый работает на износ… получает +10 к S и T, и
//  +1d10+3 к Ранам». Выход — свободное действие; «Если Хост пережил
//  Одержимость, он получает 3d10 урона во все Характеристики и 1d10 Порчи».
//
//  Здесь чистая арифметика: счёт встречного теста и итог. Броски, контроль
//  над телом (rules/actor-control.mjs) и эффекты на хосте —
//  apps/possession-attack.mjs.
// ════════════════════════════════════════════════════════════════════════

import { resolveOpposed } from "./test-kind.mjs";

/** Сколько Успехов нужно набрать суммарно, чтобы вселиться / отбиться. */
export const POSSESSION_GOAL = 5;

/** Флаг на атакующем: {targetUuid, tally} — текущая попытка. */
export const POSSESSION_ATTACK_FLAG = "possessionAttack";
/** Флаг на атакующем: {<targetUuid>: worldTime} — «не может пытаться 24 ч». */
export const POSSESSION_BARRED_FLAG = "possessionBarred";
/** Флаг на хосте: {possessorUuid, woundsBonus} — снимается при выходе. */
export const POSSESSION_HOST_FLAG = "possessionHost";
export const POSSESSION_BAR_SECONDS = 24 * 3600;

/**
 * Один Ход расширенного теста. mine — атакующий, theirs — жертва, оба в форме
 * resolveOpposed ({success, deg, threshold, unnatural}).
 *
 * Оговорка книги про Unnatural W: общее правило встречного теста (стр. 26)
 * превращает проигрыш носителя Unnatural против того, у кого его нет, в
 * «ничью» по Пределу. У Одержимости это спасение у АТАКУЮЩЕГО отнято —
 * демон, проигравший воле смертного, проигрывает честно. Жертве с Unnatural W
 * общее правило по-прежнему помогает (книга исключает только атакующего).
 * @returns {{tally:number, delta:number, outcome:"possessed"|"repelled"|"continue"}}
 */
export function possessionStep(tally, mine, theirs) {
  let res = resolveOpposed(mine, theirs);
  if (res.unnaturalTieBreak && mine?.unnatural && !theirs?.unnatural) {
    res = resolveOpposed({ ...mine, unnatural: false }, theirs);
  }
  const { winner, margin } = res;
  const delta = winner === "mine" ? margin : winner === "theirs" ? -margin : 0;
  const next = (Number(tally) || 0) + delta;
  const outcome = next >= POSSESSION_GOAL ? "possessed" : next <= -POSSESSION_GOAL ? "repelled" : "continue";
  return { tally: next, delta, outcome };
}

/** Можно ли сейчас пытаться вселиться в эту цель (24 ч после отпора). */
export function possessionBarredRemaining(barred, targetUuid, worldTime) {
  const at = Number(barred?.[targetUuid]);
  if (!Number.isFinite(at)) return 0;
  return Math.max(0, at + POSSESSION_BAR_SECONDS - Number(worldTime));
}

/** Дистанция начала: «не далее W.b м». */
export function possessionInRange(attackerWpBonus, distanceM) {
  if (distanceM == null) return true; // нет токенов — не спорим с ГМом
  return Number(distanceM) <= (Number(attackerWpBonus) || 0);
}

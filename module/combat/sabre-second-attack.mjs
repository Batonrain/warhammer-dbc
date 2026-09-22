// module/combat/sabre-second-attack.mjs
// ════════════════════════════════════════════════════════════════════════
//  Сабля, Верховая Атака (core.json, «Типы Рукопашного Оружия», разд.
//  «Меч»): «при совершении Верховой Атаки может проигнорировать бонус +20,
//  чтобы совершить две атаки вместо одной, но по разным целям на пути»
//  (wdbc-f6j9y).
//
//  Геометрии «пути» в системе нет, поэтому вторая атака устроена так
//  (решение владельца 22.09.2026): первая Верховая Атака с галочкой «вторая
//  атака вместо +20» ВЗВОДИТ метку на всаднике; до конца его Хода можно
//  совершить одну вторую атаку той же Саблей — без ОД, в обход Лимита Атак
//  за Ход, База зафиксирована «Верховая Атака» без +20. Не совершил до
//  конца Хода — метка сгорает (hooks.mjs, конец Хода; страховкой — сброс
//  на начале следующего своего Хода, rules/turn-flags.mjs).
//
//  «По разным целям» — проверяется: метка помнит токен первой цели, и
//  вторая атака по нему же не открывается. «На пути» — нет (кто стоял на
//  пути, решает стол; то же ограничение, что у Вторичных целей Очереди).
// ════════════════════════════════════════════════════════════════════════

export const NS = "warhammer-dbc";
export const SABRE_PENDING_FLAG = "sabreSecondAttackPending";

/** Сабля ли это (подтип рукопашного Меча). */
export function isSabre(sys) {
  return sys?.meleeCategory === "Меч" && sys?.meleeSubtype === "Сабля";
}

/**
 * Почему вторую атаку Саблей сейчас нельзя — пустая строка, если можно.
 * Чистая функция: всё состояние сцены приходит аргументами.
 * @param {object} p
 * @param {object|null} p.pending   значение метки SABRE_PENDING_FLAG
 * @param {string}      p.itemId    оружие, которым открывают вторую атаку
 * @param {string|null} p.targetUuid токен текущей цели
 * @param {boolean}     p.mounted   всадник всё ещё верхом
 * @param {boolean}     p.outOfTurn в бою, но сейчас не его Ход
 */
export function sabreSecondAttackBlockReason({ pending, itemId, targetUuid, mounted, outOfTurn }) {
  if (!pending) return "вторая атака уже совершена или сгорела с концом Хода";
  if (pending.itemId && itemId && pending.itemId !== itemId) return "вторая атака — только той же Саблей";
  if (outOfTurn) return "вторая атака возможна только в свой Ход";
  if (!mounted) return "персонаж больше не верхом";
  if (!targetUuid) return "выберите цель второй атаки";
  if (pending.firstTargetUuid && targetUuid === pending.firstTargetUuid)
    return "по книге — по другой цели, не по той же";
  return "";
}

/** Токен текущей цели игрока (uuid документа) — или null. */
export function currentTargetUuid() {
  const t = [...(game.user?.targets ?? [])][0] ?? null;
  return t?.document?.uuid ?? t?.uuid ?? null;
}

/** Идёт бой, актор в нём участвует, и сейчас Ход не его. */
export function isOutOfOwnTurn(actor) {
  const combat = game.combat;
  if (!combat?.started) return false;
  const inCombat = combat.combatants?.some?.(c => c.actor?.uuid === actor.uuid);
  if (!inCombat) return false;
  return combat.combatant?.actor?.uuid !== actor.uuid;
}

/** Разбор для конкретного актора и оружия — то же, что blockReason, но со сцены. */
export function sabreSecondAttackBlockFor(actor, item) {
  return sabreSecondAttackBlockReason({
    pending: actor?.getFlag?.(NS, SABRE_PENDING_FLAG) ?? null,
    itemId: item?.id,
    targetUuid: currentTargetUuid(),
    mounted: !!actor?.system?.mount?.uuid,
    outOfTurn: isOutOfOwnTurn(actor)
  });
}

/** Первая Верховая Атака с отказом от +20 — взвести вторую атаку. */
export async function armSabreSecondAttack(actor, item) {
  await actor.setFlag(NS, SABRE_PENDING_FLAG, { itemId: item.id, firstTargetUuid: currentTargetUuid() });
}

/** Вторая атака состоялась — метка снимается. */
export async function consumeSabreSecondAttack(actor) {
  if (actor?.getFlag?.(NS, SABRE_PENDING_FLAG)) await actor.unsetFlag(NS, SABRE_PENDING_FLAG);
}

/** Конец Хода всадника — несовершённая вторая атака сгорает. */
export async function clearSabreSecondAttackAtTurnEnd(actor) {
  await consumeSabreSecondAttack(actor);
}

/**
 * Кнопка карточки первой атаки «Сабля: вторая атака». Открывает обычное
 * окно атаки той же Саблей в режиме второй атаки (attack-dialog.mjs,
 * techniqueOpts.sabreSecondAttack): База «Верховая Атака» без +20, без ОД.
 */
export async function activateSabreSecondAttack(actorUuid, itemId) {
  const actor = await fromUuid(actorUuid).catch(() => null);
  const item = actor?.items?.get(itemId);
  if (!actor || !item) return ui.notifications?.warn("Сабля: персонаж или оружие не найдены.");
  const reason = sabreSecondAttackBlockFor(actor, item);
  if (reason) return ui.notifications?.warn(`Сабля: ${reason}.`);
  const { showAttackDialog } = await import("../sheets/attack-dialog.mjs");
  return showAttackDialog(actor, item, { sabreSecondAttack: true, forceBase: "mounted" });
}

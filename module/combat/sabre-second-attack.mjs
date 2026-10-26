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

import { itemHasName } from "../rules/predicates.mjs";
import { bonusHalfAction } from "../rules/mount.mjs";
import { esc } from "../helpers/utils.mjs";

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
export function sabreSecondAttackBlockReason({ pending, itemId, targetUuid, mounted, outOfTurn,
                                               targetIsHorde = false, hussarBonusOk = true }) {
  if (!pending) return "вторая атака уже совершена или сгорела с концом Хода";
  if (pending.itemId && itemId && pending.itemId !== itemId) return "вторая атака — только той же Саблей";
  if (outOfTurn) return "вторая атака возможна только в свой Ход";
  if (!mounted) return "персонаж больше не верхом";
  // Гусар: «бонусное верховое полудействие» есть только у владельца скакуна.
  if (pending.hussar && !hussarBonusOk) return "бонусное верховое полудействие есть только у владельца скакуна";
  if (!targetUuid) return "выберите цель второй атаки";
  // Гусар: обе атаки можно направить в одну Орду; Сабля такого исключения не имеет.
  if (pending.firstTargetUuid && targetUuid === pending.firstTargetUuid && !(pending.hussar && targetIsHorde))
    return "по книге — по другой цели, не по той же";
  return "";
}

/** Гусар / Hussar (Талант Всадника, Sahara 3-cross-actor-5482): вторая Верховая Атака. */
export function hasHussar(actor) {
  return [...(actor?.items ?? [])].some(i => i?.type === "talent"
    && (itemHasName(i, "Hussar") || itemHasName(i, "Гусар")));
}

/** Первая Верховая Атака Гусара — взвести вторую (любым оружием, не привязана к предмету). */
export async function armHussarSecondAttack(actor) {
  await actor.setFlag(NS, SABRE_PENDING_FLAG, { itemId: "", hussar: true, firstTargetUuid: currentTargetUuid() });
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
  const target = [...(game.user?.targets ?? [])][0]?.actor ?? null;
  const mountUuid = actor?.system?.mount?.uuid;
  const mount = mountUuid ? [...(game.actors ?? [])].find(a => a?.uuid === mountUuid) : null;
  return sabreSecondAttackBlockReason({
    pending: actor?.getFlag?.(NS, SABRE_PENDING_FLAG) ?? null,
    itemId: item?.id,
    targetUuid: currentTargetUuid(),
    mounted: !!mountUuid,
    outOfTurn: isOutOfOwnTurn(actor),
    targetIsHorde: target?.type === "horde",
    // Скакуна нет в списке (не загружен) — не отказываем: решает стол.
    hussarBonusOk: mount ? bonusHalfAction(actor, mount) : true
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
 * Рукопашное оружие, которым Гусар может провести вторую Верховую Атаку. Книга
 * («Совершая Верховую Атаку, персонаж может … провести ещё одну верховую атаку по
 * другой цели на пути») оружие второй атаки не привязывает — решение владельца
 * 26.10.2026: выбор из рукопашного оружия актора. Только НАДЕТОЕ (system.equipped),
 * как у остальных мест, где атака выбирает оружие (combat/equipped-melee.mjs): меч
 * из рюкзака ударить не может. Оружие первой атаки (`firstId`) входит всегда: им
 * могли ударить в рукопашном профиле комбинированного оружия.
 */
export function hussarSecondWeapons(actor, firstId = "") {
  return [...(actor?.items ?? [])].filter(i => i?.type === "weapon"
    && ((i.system?.weaponClass === "melee" && i.system?.equipped) || (firstId && i.id === firstId)));
}

/**
 * Окно выбора оружия второй атаки Гусара. Одно подходящее оружие — выбор не нужен;
 * закрытое окно / «Отмена» — null (вторая атака остаётся взведённой, можно открыть
 * снова). Оружие первой атаки выбрано по умолчанию.
 * @returns {Promise<?Item>}
 */
export async function chooseHussarWeapon(actor, firstId = "") {
  const list = hussarSecondWeapons(actor, firstId);
  if (list.length <= 1) return list[0] ?? null;
  const options = list.map(i =>
    `<option value="${esc(i.id)}"${i.id === firstId ? " selected" : ""}>${esc(i.name)}${i.id === firstId ? " (первая атака)" : ""}</option>`).join("");
  const id = await foundry.applications.api.DialogV2.wait({
    window: { title: `Гусар: вторая Верховая Атака — ${actor.name}` },
    content: `<p>Вторая Верховая Атака по другой цели — бонусное верховое полудействие. Каким рукопашным оружием?</p>
      <label>Оружие: <select name="weapon">${options}</select></label>`,
    buttons: [
      { action: "go", label: "Атаковать", default: true, callback: (_ev, button) => button.form.querySelector('[name="weapon"]')?.value },
      { action: "cancel", label: "Отмена", callback: () => null }
    ],
    rejectClose: false
  });
  return id ? (list.find(i => i.id === id) ?? null) : null;
}

/**
 * Кнопка карточки первой атаки «Сабля: вторая атака». Открывает обычное
 * окно атаки той же Саблей в режиме второй атаки (attack-dialog.mjs,
 * techniqueOpts.sabreSecondAttack): База «Верховая Атака» без +20, без ОД.
 * Гусар (метка pending.hussar): оружие второй атаки выбирается из рукопашного
 * оружия актора (chooseHussarWeapon), а не берётся то же, что у первой.
 */
export async function activateSabreSecondAttack(actorUuid, itemId) {
  const actor = await fromUuid(actorUuid).catch(() => null);
  let item = actor?.items?.get(itemId);
  if (!actor || !item) return ui.notifications?.warn("Сабля: персонаж или оружие не найдены.");
  // Условия, не зависящие от оружия (цель, Ход, верхом, полудействие), — ДО окна
  // выбора: незачем выбирать оружие, чтобы потом услышать «выберите цель».
  let reason = sabreSecondAttackBlockFor(actor, item);
  if (reason) return ui.notifications?.warn(`Сабля: ${reason}.`);
  if (actor.getFlag?.(NS, SABRE_PENDING_FLAG)?.hussar) {
    item = await chooseHussarWeapon(actor, itemId);
    if (!item) return null;
    reason = sabreSecondAttackBlockFor(actor, item);   // пока выбирали, сцена могла измениться
    if (reason) return ui.notifications?.warn(`Сабля: ${reason}.`);
  }
  const { showAttackDialog } = await import("../sheets/attack-dialog.mjs");
  return showAttackDialog(actor, item, { sabreSecondAttack: true, forceBase: "mounted" });
}

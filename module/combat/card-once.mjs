// module/combat/card-once.mjs
// ════════════════════════════════════════════════════════════════════════
//  Одноразовое действие с карточки чата (wdbc-6rjtc.2/.3): бесплатный
//  переброс Огневой Точки, Хирургия Легиона из меню Очков, «провал → успех»
//  за Очко Бесчестия.
//
//  «Уже сделано» — флаг на самом ChatMessage: виден всем клиентам и
//  переживает перезагрузку. Поставить его может только владелец сообщения;
//  если нажал не автор карточки (ГМ бросил тест с листа игрока), отметку
//  ставит активный ГМ сокетом (action "messageUsedFlag", warhammer-dbc.mjs) —
//  тот же приём, что persistDamageBoost (combat/soulfire.mjs). Пока действие
//  идёт и пока ГМ не записал флаг, держит локальная метка: двойной клик не
//  успевает списать Очко дважды.
// ════════════════════════════════════════════════════════════════════════

const NS = "warhammer-dbc";

/** Ключи флагов, которые ГМ ставит по просьбе игрока (белый список сокета). */
export const CARD_ONCE_FLAGS = ["infamyFailSuccessUsed", "attackRerolled", "legionSurgeryUsed",
  // 1d10 Знаний Веков после траты Очка (apps/knowledge-of-ages.mjs, wdbc-1rno.23).
  "knowledgeOfAgesRolled"];

const local = new Set();
const localKey = (message, key) => `${message?.id}:${key}`;

/** Действие с этой карточки уже сделано (флагом или только что на этом клиенте). */
export function cardOnceUsed(message, key) {
  return !!message?.getFlag?.(NS, key) || local.has(localKey(message, key));
}

/** Пометить карточку: своё сообщение — сами, чужое — через активного ГМа. */
export async function markCardOnce(message, key) {
  local.add(localKey(message, key));
  if (message.isOwner) return message.setFlag(NS, key, true);
  game.socket?.emit("system.warhammer-dbc",
    { action: "messageUsedFlag", messageId: message.id, key, userId: game.user.id });
}

/**
 * Выполнить `run` один раз на карточку. Порядок: уже сделано? → есть кому
 * поставить отметку? → действие → отметка. Проверка и локальная метка стоят
 * до первого await — второй клик, пришедший, пока первый ещё тратит Очко,
 * отбивается.
 * @param {ChatMessage} message
 * @param {string} key один из CARD_ONCE_FLAGS
 * @param {() => Promise<boolean>} run true — действие состоялось
 * @param {string} [usedWarning]
 * @returns {Promise<boolean>} состоялось ли действие
 */
export async function runCardOnce(message, key, run, usedWarning = "С этой карточки это уже сделано.") {
  if (cardOnceUsed(message, key)) { ui.notifications?.warn(usedWarning); return false; }
  if (!message.isOwner && !game.users?.activeGM) {
    ui.notifications?.warn("Карточка не ваша, а Мастера нет в игре — отметить её некому, действие не выполнено.");
    return false;
  }
  const k = localKey(message, key);
  local.add(k);
  let done = false;
  try { done = !!(await run()); }
  finally { if (!done) local.delete(k); }
  if (done) await markCardOnce(message, key);
  return done;
}

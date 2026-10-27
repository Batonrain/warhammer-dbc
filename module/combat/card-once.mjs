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
  // Трата Очка «Успех» из меню карточки теста (apps/infamy-success.mjs): +Успех дописан в эту карточку.
  "infamySuccessAdded",
  // 1d10 Знаний Веков после траты Очка (apps/knowledge-of-ages.mjs, wdbc-1rno.23).
  "knowledgeOfAgesRolled",
  // Тест «T+0, или Кровотечение» Критического Эффекта (combat/shock-death.mjs::rollBleedingTest, 3-edc4 п.18).
  "bleedTestRolled",
  // Мастерство: автоуспех за Очко (combat/mastery.mjs) и «За Гранью Человека»:
  // оставить первый результат переброса (combat/beyond-human.mjs).
  "masteryAutoSuccessUsed", "beyondHumanKept",
  // Таланты Стойкости на карточке Критического Эффекта (crit-talents.mjs, shock-death.mjs):
  // Последний Рывок, Не Умирать, Боль — Лишь Иллюзия и тест «смерть от шока».
  "finalPushUsed", "neverDieUsed", "painIllusionUsed", "finalPushApplied",
  // Ключи попыток без итога (runCardOnce с persist:false) флагом не пишутся, но стыковочный тест требует их в списке.
  "finalPushTried", "painTried", "shockDeathRolled",
  // Вырубание: «сбить с ног» с карточки урона при успешном Оглушении (combat/takedown.mjs).
  "takedownKnockdown",
  // Ключевые Силы (Талант Псайканы, combat/psyker-pools.mjs): бесплатная способность Очка Бесчестия — одна на карточку манифестации.
  "signatureFreeUsed",
  // Переброс психотеста Ключевой Силой (combat/psyker-pools.mjs::handlePsyRerollClick): карточка переброшена и заменена.
  "psyRerolled",
  // Порча Варп-Шока прежнего результата при переброске снята (combat/psyker-pools.mjs::returnWarpShock) — один раз на карточку.
  "psyWarpShockReturned",
  // Психический Вампир (Талант Псайканы, combat/psychic-vampire.mjs): одна попытка поглотить душу с карточки урона.
  "vampireUsed",
  // Варп-Замок (Талант Псайканы, combat/warp-lock.mjs): одно «аварийное» применение с карточки Феномена/Прорыва.
  "warpLockUsed",
  // Холодная Ярость (combat/rage-behavior.mjs::rerollRageExit): переброс неудачной попытки выйти из Ярости — один на карточку.
  "rageExitRerolled",
  // Снайпер Ужаса: один тест Intimidate(BS)+0 на попадание (combat/terror-sniper.mjs).
  "terrorSniperRolled",
  // Таланты Пугилиста: свободные действия с карточек Захвата и Пинка (3-eddb) — Швырнуть
  // (Метнуть/Замахнуться — одно действие), обе части Наскока и Пинок с Разворота.
  "slamUsed", "pounceKnockdownUsed", "pounceGrabUsed", "roundhouseUsed",
  // Саботаж (Талант Разбойника, combat/sabotage.mjs): Клин/отключение оружия цели с карточки удара.
  "sabotageApplied",
  // Разрубить (Талант «Рукопашных», combat/cleave.mjs): одна свободная атака с карточки урона.
  "cleaveUsed",
  // Подрезать Сухожилья (Талант «Рукопашных», combat/hamstring.mjs): один встречный тест с карточки урона.
  "hamstringUsed",
  // Жнец (Талант «Рукопашных», combat/reaper-chain.mjs): один переход к следующей цели с карточки урона.
  "reaperUsed",
  // Трофей (Мастер Казней, combat/trophy-kill.mjs): одно решение ГМа о начислении Очков Трофеев с карточки убийства.
  "trophyAwarded",
  // Рисовка (Талант «Рукопашных», combat/show-off.mjs): одна свободная атака по цели с её карточки победы.
  "showOffAttackUsed",
  // Упорство (Талант «Рукопашных», combat/tenacity.mjs): один повтор атаки с карточки.
  "tenacityUsed",
  // Сцепление Клинков (Талант «Рукопашных», combat/blade-binding.mjs): один встречный тест с карточки Парирования.
  "bladeBindingUsed",
  // Пересилить (Талант Берсерка, combat/overpower.mjs): один встречный тест с карточки Парирования.
  "overpowerUsed",
  // Яростный Штурм (Талант Берсерка, combat/furious-assault.mjs): одна дополнительная атака за Реакцию с карточки.
  "furiousAssaultUsed",
  // Ложный Натиск (hooks.mjs, .wh-false-advance-btn): один Финт или Давление с карточки Движения.
  "falseAdvanceUsed",
  // Гренадер (Талант Метания, combat/grenadier.mjs): «уменьшить смещение» и «перебросить направление» — по разу на карточку.
  "grenadierReduceUsed", "grenadierRerollUsed",
  // Пируэт против Тарана (combat/opposed-contest.mjs::resolveRamPirouette): один бросок на карточку Тарана.
  "ramPirouetteUsed",
  // Снайпер Ужаса: тест Подавления каждого врага из карточки — по разу на врага (строка карточки = номер,
  // combat/terror-sniper.mjs::terrorSuppressKey; врагов больше TERROR_SUPPRESS_ROWS остаются без общей отметки).
  ...Array.from({ length: 20 }, (_, i) => `terrorSuppress${i}`)];

const local = new Set();
const localKey = (message, key) => `${message?.id}:${key}`;

/** Действие с этой карточки уже сделано (флагом или только что на этом клиенте). */
export function cardOnceUsed(message, key) {
  return !!message?.getFlag?.(NS, key) || local.has(localKey(message, key));
}

/** Снять отметку (Штиль вернул бесплатное Очко): локальную метку убираем всегда, флаг — если он на сообщении. */
export async function unmarkCardOnce(message, key) {
  local.delete(localKey(message, key));
  if (message?.getFlag?.(NS, key) && message.isOwner) await message.setFlag(NS, key, false);
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
export async function runCardOnce(message, key, run, usedWarning = "С этой карточки это уже сделано.", { persist = true } = {}) {
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
  // persist:false — отметка только на этом клиенте: флаг на сообщении перерисовал бы карточку у всех и
  // снова включил бы уже нажатые кнопки эффектов (они гаснут лишь в DOM) — см. combat/crit-talents.mjs.
  if (done && persist) await markCardOnce(message, key);
  return done;
}

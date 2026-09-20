// module/combat/free-attack.mjs
// ════════════════════════════════════════════════════════════════════════
//  СВОБОДНАЯ АТАКА (wdbc-2xku) — обвязка поверх измерения контакта
//  (tactical-map.mjs): preUpdateToken запоминает, с какими вражескими
//  токенами двигающийся был в Базовом/Глубоком контакте ДО перемещения,
//  updateToken сверяет ПОСЛЕ и предлагает каждому, с кем контакт разорван,
//  потратить Реакцию на рукопашный приём +0 — раз в Раунд на реагирующего
//  (isRoundCapabilityAvailable, тот же приём, что у Полной Атаки/Контратаки,
//  module/apps/game-session.mjs), независимо от того, сколько у него Реакций.
//
//  «Выход из Боя» (movement-actions.mjs, declareDisengage) ставит разовый
//  флаг flags.warhammer-dbc.disengageActive — первое же обнаруженное
//  перемещение этого токена гасит Свободные Атаки по нему и само снимает
//  флаг (действие разовое, «на одно движение»).
//
//  Глубокий Контакт (wdbc-x1nz.2.19, стр. 31): переноска раненого/пленного
//  «не вызывает никаких игромеханических эффектов, обычно связанных с
//  движениями, вроде Свободных Атак». Сама переноска (совместное движение
//  двух токенов) не автоматизирована — но пока на акторе стоит флаг
//  flags.warhammer-dbc.deepContactCarry (movement-actions.mjs::
//  toggleDeepContactCarry, пункт меню Движения), ЛЮБОЕ его движение гасит
//  Свободные Атаки, как disengageActive, но НЕ снимается само — переноска
//  обычно длится несколько перемещений подряд, снимается тем же тумблером.
//
//  Сама атака не автоматизирована целиком (нет единого «оружия реакции») —
//  клик по кнопке в чате только списывает Реакцию, отмечает Раунд и
//  назначает цель кликнувшему; сам рукопашный приём +0 наносится как обычно,
//  щелчком по оружию на листе реагирующего (module/sheets/tabs/combat.mjs).
//
//  Ограничено типами, у которых вообще посчитана База/контакт (isBaseTrackedActor
//  из tactical-map.mjs — личный масштаб ИЛИ Шагоход, wdbc-x1nz.2.21, стр. 31);
//  Орда/прочая Техника/Отряд живут другими правилами контакта и в эту
//  механику не входят.
// ════════════════════════════════════════════════════════════════════════

import { tokenRect } from "./horde-tokens.mjs";
import { contactType } from "../rules/tactical-map.mjs";
import { isBaseTrackedActor } from "./tactical-map.mjs";
import { tokenRelationship } from "../regions/auras.mjs";
import { canSpendReaction, spendReaction, hasActionEconomy } from "./action-economy.mjs";
import { isRoundCapabilityAvailable, markRoundCapabilityUsed } from "../apps/game-session.mjs";
import { esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { clearPinnedOnMeleeEntry } from "./suppression.mjs";

/** Флаг «раз в Раунд» (module/apps/game-session.mjs). */
export const FREE_ATTACK_CAPABILITY = "freeAttack";

function actorOf(tokenDoc) {
  return tokenDoc?.actor ?? null;
}

function isPersonalScale(tokenDoc) {
  return isBaseTrackedActor(actorOf(tokenDoc));
}

/** Враждебные токены сцены личного масштаба в Базовом/Глубоком контакте с данным документом. */
export function enemyContactTokenDocs(tokenDoc) {
  const rect = tokenRect(tokenDoc);
  if (!rect) return [];
  const out = [];
  for (const other of canvas?.tokens?.placeables ?? []) {
    const otherDoc = other.document;
    if (otherDoc.id === tokenDoc.id) continue;
    if (!isPersonalScale(otherDoc)) continue;
    if (tokenRelationship(tokenDoc.disposition, otherDoc.disposition) !== "enemy") continue;
    const rectB = tokenRect(otherDoc);
    if (!rectB) continue;
    if (contactType(rect, rectB) !== "none") out.push(otherDoc);
  }
  return out;
}

/** Экипировано ли у актора рукопашное оружие или Пистолет (стр. 30 — «Связан в Рукопашной»). */
function hasLockingWeapon(actor) {
  return (actor?.items ?? []).some(i =>
    i.type === "weapon" && i.system?.equipped
    && (i.system.weaponClass === "melee" || i.system.weaponClass === "pistol"));
}

/**
 * Связан в Рукопашной (стр. 30, wdbc-x1nz.2.64): враги личного масштаба в
 * Базовом/Глубоком контакте с данным документом, вооружённые рукопашным
 * оружием или Пистолетом — подмножество enemyContactTokenDocs выше.
 */
export function lockingContactTokenDocs(tokenDoc) {
  return enemyContactTokenDocs(tokenDoc).filter(doc => hasLockingWeapon(actorOf(doc)));
}

/**
 * ВСЕ токены личного масштаба в Базовом/Глубоком контакте с данным документом,
 * независимо от отношения (враг ИЛИ союзник) — для рикошета промаха по цели,
 * Связанной в Рукопашной (стр. 30, wdbc-x1nz.2.64): «случайный персонаж в
 * контакте с целью — это может быть как враг, так и союзник».
 */
export function allContactTokenDocs(tokenDoc) {
  const rect = tokenRect(tokenDoc);
  if (!rect) return [];
  const out = [];
  for (const other of canvas?.tokens?.placeables ?? []) {
    const otherDoc = other.document;
    if (otherDoc.id === tokenDoc.id) continue;
    if (!isPersonalScale(otherDoc)) continue;
    const rectB = tokenRect(otherDoc);
    if (!rectB) continue;
    if (contactType(rect, rectB) !== "none") out.push(otherDoc);
  }
  return out;
}

function movesPosition(changes) {
  return Object.prototype.hasOwnProperty.call(changes, "x")
      || Object.prototype.hasOwnProperty.call(changes, "y");
}

// tokenId → { ids: Set(enemyTokenId), ts }, контакт ДО перемещения (между
// pre/update одного и того же вызова).
//
// wdbc-8zi: запись чистится штатно в updateToken ниже, но апдейт токена
// может быть отменён (другой модуль вернул false из своего preUpdateToken,
// либо запрос вовсе не дошёл до сервера) — тогда updateToken для этого
// tokenId не придёт НИКОГДА, а сам токен обычно продолжает существовать
// (id не освобождается), и запись висела бы в Map бессрочно. Foundry не
// даёт отдельного хука «апдейт отменён», поэтому отмена не детектируется
// напрямую — вместо этого запись помечается временем и протухает сама:
// каждый следующий preUpdateToken/updateToken (не обязательно того же
// токена) чистит все записи старше PRE_MOVE_TTL_MS. deleteToken ниже —
// точный случай (токен удалён, апдейта для него уже не будет в принципе).
const _preMoveContacts = new Map();
const PRE_MOVE_TTL_MS = 5000;

function pruneStalePreMoveContacts(now = Date.now()) {
  for (const [id, entry] of _preMoveContacts) {
    if (now - entry.ts > PRE_MOVE_TTL_MS) _preMoveContacts.delete(id);
  }
}

export async function offerFreeAttack(reactorTokenDoc, moverTokenDoc) {
  const reactor = actorOf(reactorTokenDoc);
  if (!reactor || !hasActionEconomy(reactor)) return;
  if (!isRoundCapabilityAvailable(reactor, FREE_ATTACK_CAPABILITY)) return;
  if (!canSpendReaction(reactor)) return;

  // Это НЕ карточка теста (wdbc-kuun): ни броска, ни Порога, ни исхода —
  // предложение возможности («хочешь потратить Реакцию?»), как «запрос теста»
  // или «зона размещена». Общий сборщик helpers/test-card.mjs собирает
  // результат теста, здесь ему нечего собирать — оставлено как есть.
  const rollMode = game.settings.get("core", "rollMode");
  const messageData = ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor: reactor }),
    content: `
      <div class="wh-roll-result">
        <div class="roll-header">${rollIcon("sword", "#ff9d4d")}Свободная атака — ${esc(moverTokenDoc.name)} покидает рукопашную с ${esc(reactor.name)}</div>
        <div class="roll-threshold">Раз в Раунд, ценой Реакции: рукопашный приём +0 по уходящему.</div>
        <div class="roll-defense-btns">
          <button class="wh-free-attack-btn" type="button"
            data-reactor-uuid="${reactor.uuid}" data-mover-uuid="${moverTokenDoc.uuid}">
            Свободная атака (−1 Реакция)
          </button>
        </div>
      </div>`,
    sound: null
  }, rollMode);
  await ChatMessage.create(messageData);
}

/**
 * Разбирает уже случившееся перемещение токена: гасит один разовый флаг
 * «Выход из Боя» либо предлагает Свободную Атаку каждому врагу личного
 * масштаба, чей контакт с этим токеном пропал. Отдельная функция от
 * initFreeAttackHooks — чтобы логику можно было проверить тестом напрямую,
 * не поднимая настоящие Foundry-хуки (см. test/combat/free-attack.test.mjs).
 * @param {TokenDocument} tokenDoc
 * @param {Set<string>} beforeContactIds  id вражеских токенов в контакте ДО перемещения
 * @returns {Promise<TokenDocument[]>} враги, чей контакт с tokenDoc пропал
 */
export async function processTokenMove(tokenDoc, beforeContactIds) {
  const moverActor = actorOf(tokenDoc);
  if (moverActor?.getFlag("warhammer-dbc", "disengageActive")) {
    await moverActor.unsetFlag("warhammer-dbc", "disengageActive");
    return [];
  }
  if (moverActor?.getFlag("warhammer-dbc", "deepContactCarry")) return [];

  const afterDocs = enemyContactTokenDocs(tokenDoc);
  const after = new Set(afterDocs.map(d => d.id));
  const broken = [];
  for (const enemyId of beforeContactIds) {
    if (after.has(enemyId)) continue; // контакт с этим врагом остался
    const enemyTokenDoc = (canvas?.tokens?.placeables ?? []).find(t => t.document.id === enemyId)?.document;
    if (!enemyTokenDoc) continue;
    broken.push(enemyTokenDoc);
    await offerFreeAttack(enemyTokenDoc, tokenDoc);
  }

  // Новый контакт снимает Подавление (стр. 33, wdbc-x1nz.2.62) — у ОБЕИХ
  // сторон: и у того, кто подошёл, и у того, к кому подошли (тот тоже
  // «оказался в рукопашной», хотя сам не двигался).
  const gained = afterDocs.filter(d => !beforeContactIds.has(d.id));
  if (gained.length) {
    await clearPinnedOnMeleeEntry(moverActor);
    for (const enemyDoc of gained) await clearPinnedOnMeleeEntry(actorOf(enemyDoc));
  }
  return broken;
}

export function initFreeAttackHooks() {
  Hooks.on("preUpdateToken", (tokenDoc, changes) => {
    pruneStalePreMoveContacts();
    if (!game.combat?.started || !movesPosition(changes) || !isPersonalScale(tokenDoc)) return;
    _preMoveContacts.set(tokenDoc.id, { ids: new Set(enemyContactTokenDocs(tokenDoc).map(d => d.id)), ts: Date.now() });
  });

  Hooks.on("updateToken", async (tokenDoc, changes, options, userId) => {
    pruneStalePreMoveContacts();
    const before = _preMoveContacts.get(tokenDoc.id)?.ids;
    _preMoveContacts.delete(tokenDoc.id);
    // Только клиент, вызвавший перемещение, считает разрыв контакта — иначе
    // карточка в чат ушла бы с каждого подключённого клиента разом.
    if (userId !== game.user.id) return;
    if (!before || before.size === 0) return;
    if (!game.combat?.started || !movesPosition(changes)) return;
    await processTokenMove(tokenDoc, before);
  });

  // Токен удалён до того, как пришёл updateToken (отменённый/незавершённый
  // драг, удаление ГМ-ом прямо во время хода) — апдейта для этого id уже не
  // будет никогда, ждать TTL незачем.
  Hooks.on("deleteToken", tokenDoc => {
    _preMoveContacts.delete(tokenDoc.id);
  });
}

/**
 * Клик по кнопке в чате — списывает Реакцию реагирующего, отмечает Раунд и
 * назначает уходящего целью кликнувшего (дальше — обычный клик по оружию на
 * листе реагирующего, как у любой другой рукопашной атаки).
 */
export async function resolveFreeAttackClick(reactorUuid, moverUuid) {
  const reactor = await fromUuid(reactorUuid).catch(() => null);
  if (!reactor) return ui.notifications.warn("⚠️ Актор реагирующего не найден.");
  if (!reactor.isOwner) return ui.notifications.warn("⚠️ Нет прав на этого актора.");
  if (!isRoundCapabilityAvailable(reactor, FREE_ATTACK_CAPABILITY)) {
    return ui.notifications.warn(`⚠️ ${reactor.name}: Свободная атака уже потрачена в этом Раунде.`);
  }
  if (!await spendReaction(reactor)) {
    return ui.notifications.warn(`⚠️ ${reactor.name}: не хватает Реакции.`);
  }
  await markRoundCapabilityUsed(reactor, FREE_ATTACK_CAPABILITY);

  const moverTokenDoc = await fromUuid(moverUuid).catch(() => null);
  const moverToken = moverTokenDoc?.object;
  // Foundry v14 убрала User#updateTokenTargets — на ней клик по кнопке падал
  // TypeError'ом ПОСЛЕ списания Реакции: реагирующий платил, а цель не
  // назначалась и уведомление «нанесите приём» не появлялось вовсе (найдено
  // живой проверкой). Таргет ставится тем же способом, что и везде в системе
  // (combat/aim.mjs, module/hooks.mjs): Token#setTarget с releaseOthers.
  if (moverToken && canvas?.ready) {
    moverToken.setTarget(true, { user: game.user, releaseOthers: true });
  }
  ui.notifications.info(`${reactor.name}: Реакция потрачена — нанесите рукопашный приём +0 по ${moverTokenDoc?.name ?? "цели"} со своего листа.`);
}

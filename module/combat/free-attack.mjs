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
//  Сама атака не автоматизирована целиком (нет единого «оружия реакции») —
//  клик по кнопке в чате только списывает Реакцию, отмечает Раунд и
//  назначает цель кликнувшему; сам рукопашный приём +0 наносится как обычно,
//  щелчком по оружию на листе реагирующего (module/sheets/tabs/combat.mjs).
//
//  Ограничено личным масштабом (BASE_SIZE_TYPES из tactical-map.mjs) — тем же
//  типам, для которых вообще посчитана База/контакт; Орда/Техника/Отряд живут
//  другими правилами контакта и в эту механику не входят.
// ════════════════════════════════════════════════════════════════════════

import { tokenRect } from "./horde-tokens.mjs";
import { contactType } from "../rules/tactical-map.mjs";
import { BASE_SIZE_TYPES } from "./tactical-map.mjs";
import { tokenRelationship } from "../regions/auras.mjs";
import { canSpendReaction, spendReaction, hasActionEconomy } from "./action-economy.mjs";
import { isRoundCapabilityAvailable, markRoundCapabilityUsed } from "../apps/game-session.mjs";
import { esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";

/** Флаг «раз в Раунд» (module/apps/game-session.mjs). */
export const FREE_ATTACK_CAPABILITY = "freeAttack";

function actorOf(tokenDoc) {
  return tokenDoc?.actor ?? null;
}

function isPersonalScale(tokenDoc) {
  return BASE_SIZE_TYPES.includes(actorOf(tokenDoc)?.type);
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

function movesPosition(changes) {
  return Object.prototype.hasOwnProperty.call(changes, "x")
      || Object.prototype.hasOwnProperty.call(changes, "y");
}

// tokenId → Set(enemyTokenId), контакт ДО перемещения (между pre/update одного и того же вызова).
const _preMoveContacts = new Map();

export async function offerFreeAttack(reactorTokenDoc, moverTokenDoc) {
  const reactor = actorOf(reactorTokenDoc);
  if (!reactor || !hasActionEconomy(reactor)) return;
  if (!isRoundCapabilityAvailable(reactor, FREE_ATTACK_CAPABILITY)) return;
  if (!canSpendReaction(reactor)) return;

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

  const after = new Set(enemyContactTokenDocs(tokenDoc).map(d => d.id));
  const broken = [];
  for (const enemyId of beforeContactIds) {
    if (after.has(enemyId)) continue; // контакт с этим врагом остался
    const enemyTokenDoc = (canvas?.tokens?.placeables ?? []).find(t => t.document.id === enemyId)?.document;
    if (!enemyTokenDoc) continue;
    broken.push(enemyTokenDoc);
    await offerFreeAttack(enemyTokenDoc, tokenDoc);
  }
  return broken;
}

export function initFreeAttackHooks() {
  Hooks.on("preUpdateToken", (tokenDoc, changes) => {
    if (!game.combat?.started || !movesPosition(changes) || !isPersonalScale(tokenDoc)) return;
    _preMoveContacts.set(tokenDoc.id, new Set(enemyContactTokenDocs(tokenDoc).map(d => d.id)));
  });

  Hooks.on("updateToken", async (tokenDoc, changes, options, userId) => {
    const before = _preMoveContacts.get(tokenDoc.id);
    _preMoveContacts.delete(tokenDoc.id);
    // Только клиент, вызвавший перемещение, считает разрыв контакта — иначе
    // карточка в чат ушла бы с каждого подключённого клиента разом.
    if (userId !== game.user.id) return;
    if (!before || before.size === 0) return;
    if (!game.combat?.started || !movesPosition(changes)) return;
    await processTokenMove(tokenDoc, before);
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
  if (moverToken && canvas?.ready) {
    await game.user.updateTokenTargets([moverToken.id]);
  }
  ui.notifications.info(`${reactor.name}: Реакция потрачена — нанесите рукопашный приём +0 по ${moverTokenDoc?.name ?? "цели"} со своего листа.`);
}

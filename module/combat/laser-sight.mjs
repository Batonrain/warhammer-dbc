// module/combat/laser-sight.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Лазерная точка — поток (правила и трактовка — rules/laser-sight.mjs).
//
//  1. После дальнобойной атаки с Лазерным/Омни-прицелом (attack.mjs) →
//     whisperLaserDotToGM: ГМу автоматически уходит шёпот со строками врагов.
//     Решение владельца 30.10.2026: не кнопка на карточке атаки — её видит и
//     жмёт стрелок, которому нажимать невыгодно («выдаю себя»), — а шёпот ГМу.
//     Шёпот создаёт клиент стрелка (любой игрок вправе писать адресные
//     сообщения), с blind: стрелок содержимого не видит (кто что заметил — не его знание).
//  2. Строка на каждого врага стрелка, которому видно место, куда светит точка
//     (токен цели; isTokenInSight, rules/vision-target.mjs — приближённо, без
//     стен). Галочка «уже знает, где стрелок» (по умолчанию — стрелок у него в
//     поле зрения) и кнопка теста Внимательности−10.
//  3. Кнопка строки → rollLaserDotNotice: Awareness−10 за этого врага. Нажимает
//     ГМ (шёпот видит только он); бросок разрешён и владельцу врага. Галочка
//     отмечена — тест не нужен, замечать нечего. «Раз на строку» — флаг laserSpotN
//     на самом шёпоте: сообщение написал клиент игрока, поэтому ГМ ставит его
//     сам (у ГМа в Foundry любой документ «свой»); сокет card-once (messageUsedFlag) остаётся запасным путём.
//
//  Образец — combat/terror-sniper.mjs (строки врагов, раз на строку, раз на карточку).
// ════════════════════════════════════════════════════════════════════════════

import { tokenRelationship, tokenDocDistance } from "../regions/auras.mjs";
import { isTokenInSight } from "../rules/vision-target.mjs";
import { collectTestMods } from "../rules/roll-mods.mjs";
import { testOutcome } from "../rules/roll-outcome.mjs";
import { LASER_DOT_TEST_MOD, LASER_SPOT_ROWS, awarenessBase } from "../rules/laser-sight.mjs";
import { postTestCard, rollStatLine } from "../helpers/test-card.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { esc } from "../helpers/utils.mjs";
import { runCardOnce } from "./card-once.mjs";

/** Id пользователей-ГМов: адресаты шёпота. Пустой список = сообщение стало бы публичным, поэтому им не пользуются. */
const gmWhisperIds = () => (ChatMessage.getWhisperRecipients?.("GM") ?? []).map(u => u?.id ?? u).filter(Boolean);

/**
 * Враги стрелка, которым видно место, куда светит точка.
 * @returns {{token: TokenDocument, knows: boolean}[]} knows — стрелок уже в поле зрения врага;
 *   ближайшие к цели первыми, не больше LASER_SPOT_ROWS
 */
export function laserDotObservers({ shooterDoc, targetDoc }) {
  const scene = targetDoc?.parent;
  const grid = scene?.grid;
  if (!shooterDoc || !targetDoc || !grid) return [];
  return scene.tokens.contents
    .filter(t => t.id !== shooterDoc.id && !t.hidden && t.actor
      && tokenRelationship(shooterDoc.disposition, t.disposition) === "enemy"
      && isTokenInSight(t, targetDoc, grid))
    .sort((a, b) => tokenDocDistance(a, targetDoc, grid) - tokenDocDistance(b, targetDoc, grid))
    .slice(0, LASER_SPOT_ROWS)
    .map(token => ({ token, knows: isTokenInSight(token, shooterDoc, grid) }));
}

const rowHtml = ({ token, knows }, attackerUuid) => `
  <div class="wh-laser-row" style="display:flex;gap:6px;align-items:center;margin:2px 0;">
    <b>${esc(token.name ?? token.actor?.name ?? "?")}</b>
    <label style="font-size:0.85em;"><input type="checkbox" class="wh-laser-knows-cb"${knows ? " checked" : ""}> уже знает, где стрелок</label>
    <button class="wh-laser-notice-btn" type="button" data-actor-uuid="${esc(token.actor?.uuid ?? "")}" data-attacker-uuid="${esc(attackerUuid)}">Внимательность−10</button>
  </div>`;

/**
 * Шёпот ГМу после дальнобойной атаки с точкой лазера: карточка с рядом на каждого врага.
 * Зовётся с клиента стрелка (игрока или ГМа) сразу после карточки атаки.
 * @param {Actor} actor стрелок
 * @param {string} targetTokenUuid uuid токена цели ("" — цели нет/не на сцене)
 * @returns {Promise<boolean>} true — шёпот создан; false — слать нечего (ГМов нет или замечать некому)
 */
export async function whisperLaserDotToGM(actor, targetTokenUuid) {
  if (!actor) return false;
  const gms = gmWhisperIds();
  if (!gms.length) return false;
  const targetDoc = targetTokenUuid ? await fromUuid(targetTokenUuid).catch(() => null) : null;
  const shooterDoc = actor.getActiveTokens?.()?.[0]?.document ?? null;
  const observers = laserDotObservers({ shooterDoc, targetDoc });
  const located = !!(shooterDoc && targetDoc);
  // Оба токена найдены, а видящих точку врагов нет — замечать некому, чат не засоряем.
  // Токен не найден — наблюдателей определяет стол, ГМа об этом предупреждаем.
  if (!observers.length && located) return false;
  const sections = [observers.length
    ? `<div class="roll-laser-dot"><div style="font-size:0.85em;">Галочка «уже знает, где стрелок» — по умолчанию там, где стрелок виден врагу; поправьте, если иначе. Знающему тест не нужен. Книга: точку «можно заметить через тест Awareness−10».</div>${
        observers.map(o => rowHtml(o, actor.uuid || "")).join("")}</div>`
    : `<div class="roll-allout-note">Врагов, которым видна точка, нет (токен стрелка или цели не найден на сцене — определите наблюдателей вручную).</div>`];
  await postTestCard(actor, {
    icon: rollIcon("target", "#ff5a5a"), title: `Лазерная точка — ${esc(actor.name)}`,
    outcome: `<span class="roll-success">Красная точка на цели — враги могут заметить, откуда стреляют (Внимательность−10).</span>`,
    sections
  }, { whisper: gms, blind: true, sound: false });
  return true;
}

/** Ключ отметки на карточке для строки врага номер i ("" — строк больше, чем ключей: отметка только на этом клиенте). */
export const laserSpotKey = i => (Number.isInteger(i) && i >= 0 && i < LASER_SPOT_ROWS ? `laserSpot${i}` : "");

/**
 * Тест Внимательности−10 одного врага: заметил ли он красную точку и откуда стреляют.
 * @returns {Promise<boolean>} true — тест брошен (кнопку можно гасить)
 */
export async function rollLaserDotNotice(actorUuid, attackerUuid, knows) {
  const actor = await fromUuid(actorUuid).catch(() => null);
  if (!actor) { ui.notifications.warn("⚠️ Цель не найдена."); return false; }
  if (knows) { ui.notifications.info(`${actor.name} уже знает, где стрелок — замечать нечего.`); return false; }
  if (!actor.isOwner && !game.user?.isGM) { ui.notifications.warn(`⚠️ Нет прав бросать за ${actor.name} — тест проведёт его владелец или ГМ.`); return false; }
  const shooter = await fromUuid(attackerUuid || "").catch(() => null);
  const base = awarenessBase(actor) + LASER_DOT_TEST_MOD;
  const ruleMods = collectTestMods(actor, { kind: "skill", skill: "awareness", char: "per" });
  const threshold = base + ruleMods.total;
  const roll = await new Roll("1d100").evaluate();
  const rv = roll.total;
  const { success } = testOutcome(rv, threshold);
  await postTestCard(actor, {
    icon: rollIcon("target", "#ff5a5a"), title: `Лазерная точка — ${esc(actor.name)}`,
    threshold: rollStatLine({ label: "Awareness−10", base, parts: ruleMods.parts, threshold, rv }),
    outcome: success
      ? `<span class="roll-success">Заметил(а) красную точку — знает, где стрелок${shooter ? ` (${esc(shooter.name)})` : ""}.</span>`
      : `<span class="roll-failure">Не заметил(а) красную точку.</span>`
  }, { rolls: [roll] });
  return true;
}

/**
 * Клик «Внимательность−10» у строки врага: раз на карточку и на врага — отметка лежит во флаге сообщения,
 * а не только в DOM нажавшего (после F5 и у другого клиента кнопка остаётся погашенной).
 */
export function laserDotNoticeOnCard(message, rowIndex, actorUuid, attackerUuid, knows) {
  const key = laserSpotKey(rowIndex);
  const run = () => rollLaserDotNotice(actorUuid, attackerUuid, knows);
  const warning = "Тест этого врага с карточки уже брошен.";
  return key ? runCardOnce(message, key, run, warning) : run();
}

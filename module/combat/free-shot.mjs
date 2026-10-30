// module/combat/free-shot.mjs
// ════════════════════════════════════════════════════════════════════════════
//  БЕСПЛАТНЫЕ ОДИНОЧНЫЕ ВЫСТРЕЛЫ ТАЛАНТОВ СТРЕЛКА (Sahara 3-5fbf, решения
//  владельца 24.10.2026):
//
//   Стрельба от Бедра (Hip Shooting) — после Полного Движения «от бедра»
//   (combat/movement-actions.mjs::declareFullMove) — один Одиночный Выстрел
//   того же Хода без ОД; он считается Атакой Хода (лимит Атак действует).
//
//   Огонь с Вытягивания (Draw Fire) — при Взять пистолет с удобной разгрузки
//   чат предлагает бесплатный не-Избирательный Одиночный Выстрел; раз в Раунд;
//   «не считается атакой в расчёте других атак» — лимит Атак не проверяется и
//   не растёт.
//
//  Выстрел делает обычное окно атаки (sheets/attack-dialog.mjs) с
//  techniqueOpts.freeShot: оно отключает списание ОД, запирает Одиночный Выстрел
//  и «Без прицела», а Стрельбе от Бедра ещё и убирает бонус Прицеливания.
// ════════════════════════════════════════════════════════════════════════════

import { esc } from "../helpers/utils.mjs";
import { COVERING_FIRE_OFFER_FLAG } from "../rules/gunner-talents.mjs";
import { HIP_SHOOTING_FLAG, DRAW_FIRE_ROUND_FLAG, hipShootingEligibleWeapon, hipShootingWeapon,
  drawFireOffered } from "../rules/gunner-talents.mjs";
import { isRoundCapabilityAvailable, markRoundCapabilityUsed } from "../apps/game-session.mjs";
import { inAwkwardRigLocation } from "../constants/rig.mjs";
import {
  RUN_AND_GUN_PENDING_FLAG, RUN_AND_GUN_FIRED_FLAG, BAYONET_SHOT_PENDING_FLAG, CHARGE_CHECKED_FLAG, hasRunAndGun, hasBayonetCharge,
  runAndGunEligibleWeapon, bayonetShotEligibleWeapon, equippedWeaponsWhere, runAndGunLockReason
} from "../rules/run-and-gun.mjs";
import { RUNNING_THROW_PENDING_FLAG, runningThrowEligibleWeapon } from "../rules/throwing-talents.mjs";
import { enemyContactTokenDocs } from "./free-attack.mjs";

const NS = "warhammer-dbc";

/** Виды бесплатных выстрелов (значение techniqueOpts.freeShot). */
export const FREE_SHOT_KINDS = Object.freeze({
  hipShooting: "hipShooting", drawFire: "drawFire", runAndGun: "runAndGun", bayonetCharge: "bayonetCharge", runningThrow: "runningThrow"
});

/**
 * Кнопки бесплатного выстрела Стрельбы на Бегу для карточки Натиска ("" — нет Таланта или оружия).
 * Метка «выстрел ещё не сделан» ставится в declareCharge (combat/movement-actions.mjs).
 */
export function runAndGunOfferHtml(actor) {
  if (!hasRunAndGun(actor)) return "";
  const guns = equippedWeaponsWhere(actor, runAndGunEligibleWeapon);
  if (!guns.length) return `<div class="roll-threshold">Стрельба на Бегу: нет экипированного не-тяжёлого оружия для выстрела.</div>`;
  return `<div class="roll-threshold">Стрельба на Бегу: из любой точки Натиска — свободный выстрел из не-тяжёлого оружия (не Избирательный). Не сложите оружие после выстрела — им нельзя стрелять в рукопашной до конца Хода.</div>
    ${guns.map(g => `<button class="wh-free-shot-btn" type="button" data-kind="runAndGun" data-actor-uuid="${actor.uuid}" data-item-id="${g.id}">🏃 Выстрел на Бегу: ${esc(g.name)}</button>`).join("")}`;
}

/** Метка проверки Натиска этого Раунда: «<id боя>:<раунд>» ("" — вне боя, метка не ставится). */
function chargeRoundKey() {
  const c = game.combat;
  return c?.started ? `${c.id}:${c.round}` : "";
}

/**
 * Отметить, что проверка Натиска этого Раунда сделана (HUD-кнопка declareCharge и окно атаки).
 * Вне боя метки нет — проверка идёт каждый раз.
 */
export async function markChargeChecked(actor) {
  const key = chargeRoundKey();
  if (key && actor?.setFlag) await actor.setFlag(NS, CHARGE_CHECKED_FLAG, key);
}

/** Тест Подавления провален: в этом Раунде Натиск не удался, второй попытки (HUD или окно) нет. */
export async function markChargeFailed(actor) {
  const key = chargeRoundKey();
  if (key && actor?.setFlag) await actor.setFlag(NS, CHARGE_CHECKED_FLAG, `${key}:failed`);
}

/** Натиск уже провален в этом Раунде тестом Подавления (HUD-кнопка не даёт попытаться снова). */
export function chargeFailedThisRound(actor) {
  const key = chargeRoundKey();
  return !!key && actor?.getFlag?.(NS, CHARGE_CHECKED_FLAG) === `${key}:failed`;
}

/**
 * Натиск как База в окне атаки (не HUD-кнопка): тот же ход, что у declareCharge, — тест Подавления
 * Прикрывающего Огня у бывшего противника стрелка. Один раз за Раунд: если Натиск уже объявляли
 * (HUD или прошлая Атака Натиска этого Раунда), проверку не повторяем.
 * Зовётся ДО списания ОД: провал — атака не совершается.
 * @returns {Promise<{ok:boolean, first:boolean}>} ok=false — тест Подавления провален; first=true — проверка шла сейчас
 */
export async function chargeAttackGate(actor) {
  const key = chargeRoundKey();
  const mark = actor?.getFlag?.(NS, CHARGE_CHECKED_FLAG);
  if (key && mark === key) return { ok: true, first: false };
  // Тест Подавления уже провален в этом Раунде (HUD или прошлая попытка) — Натиск не удался, перебрасывать нельзя.
  if (key && mark === `${key}:failed`) return { ok: false, first: false };
  const { coveringFireChargeCheck } = await import("./covering-fire.mjs");
  if (!await coveringFireChargeCheck(actor)) { await markChargeFailed(actor); return { ok: false, first: true }; }
  await markChargeChecked(actor);
  return { ok: true, first: true };
}

/**
 * Атака Натиска состоялась (ОД списаны): первая за Раунд взводит Стрельбу на Бегу и кладёт в чат
 * кнопки выстрела — как карточка declareCharge.
 */
export async function chargeAttackStarted(actor, first) {
  if (!first || !hasRunAndGun(actor)) return;
  await actor.setFlag(NS, RUN_AND_GUN_PENDING_FLAG, true);
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="wh-roll-result">
      <div class="roll-header">${esc(actor.name)} — Натиск</div>${runAndGunOfferHtml(actor)}
    </div>`
  });
}

/** Кнопки свободного выстрела Штыковой Атаки для карточки попадания ("" — не предлагать). */
export function bayonetShotButtonsHtml(actor) {
  if (!hasBayonetCharge(actor) || !actor.getFlag?.(NS, BAYONET_SHOT_PENDING_FLAG)) return "";
  const guns = equippedWeaponsWhere(actor, bayonetShotEligibleWeapon);
  if (!guns.length) return `<div class="roll-allout-note">Штыковая Атака: нет экипированного огнестрельного оружия для выстрела в упор.</div>`;
  return guns.map(g => `<button class="wh-free-shot-btn" type="button" data-kind="bayonetCharge" data-actor-uuid="${actor.uuid}" data-item-id="${g.id}" title="Свободное действие: выстрел как в упор (+30), несмотря на связанность в рукопашной">🔫 Штыковая Атака: выстрел из ${esc(g.name)}</button>`).join("");
}

/** В базовом/глубоком контакте ли актор с врагом сейчас (токен на сцене). */
export function actorInMeleeContact(actor) {
  const doc = actor?.getActiveTokens?.()?.[0]?.document;
  return !!doc && enemyContactTokenDocs(doc).length > 0;
}

/**
 * Замок Стрельбы на Бегу: из оружия, которым стреляли на Натиске и не сложили,
 * в рукопашной в этот Ход стрелять нельзя ("" — можно).
 */
export function runAndGunLockedNow(actor, item, { isMelee }) {
  if (isMelee || !actor?.getFlag?.(NS, RUN_AND_GUN_FIRED_FLAG)) return "";
  return runAndGunLockReason(actor, item, { isMelee, inMelee: actorInMeleeContact(actor) });
}

/** Оружие сложили (sheets/tabs/gear.mjs::equipItem) — замок Стрельбы на Бегу снимается. */
export async function releaseRunAndGunLock(actor, item) {
  if (actor?.getFlag?.(NS, RUN_AND_GUN_FIRED_FLAG) === item?.id) await actor.unsetFlag(NS, RUN_AND_GUN_FIRED_FLAG);
}

/**
 * Разметка кнопки Огня с Вытягивания для чата при Взять пистолет, "" — не предлагать.
 * @param {Actor} actor
 * @param {Item}  item   взятое в руки оружие
 */
export function drawFireOfferHtml(actor, item) {
  if (!drawFireOffered(actor, item, { awkwardRig: inAwkwardRigLocation(actor, item) })) return "";
  if (!isRoundCapabilityAvailable(actor, DRAW_FIRE_ROUND_FLAG)) return "";
  return `<div class="roll-threshold">Огонь с Вытягивания: раз в Раунд можно сразу, свободным действием, выстрелить из <b>${esc(item.name)}</b> одиночным не-Избирательным выстрелом — он не считается Атакой Хода.</div>
    <button class="wh-free-shot-btn" type="button" data-kind="drawFire" data-actor-uuid="${actor.uuid}" data-item-id="${item.id}">🔫 Огонь с Вытягивания: выстрел из ${esc(item.name)}</button>`;
}

/**
 * Клик по кнопке бесплатного выстрела в чате: проверить условия и открыть окно атаки.
 * @param {string} actorUuid
 * @param {"hipShooting"|"drawFire"} kind
 * @param {string} [itemId]  оружие (у Огня с Вытягивания — то, что взяли)
 */
export async function activateFreeShot(actorUuid, kind, itemId = "") {
  const actor = await fromUuid(actorUuid).catch(() => null);
  if (!actor) return ui.notifications?.warn("Бесплатный выстрел: персонаж не найден.");
  if (actor.isOwner === false) return ui.notifications?.warn("Бесплатный выстрел: решать может только владелец персонажа (или ГМ).");
  if (kind === FREE_SHOT_KINDS.hipShooting) {
    if (!actor.getFlag?.(NS, HIP_SHOOTING_FLAG)) return ui.notifications?.warn("Стрельба от Бедра: выстрел уже сделан или Ход закончился.");
    const item = (itemId && actor.items.get(itemId)) || hipShootingWeapon(actor);
    if (!item || !hipShootingEligibleWeapon(item)) {
      return ui.notifications?.warn("Стрельба от Бедра: нужно экипированное оружие — не длинная винтовка и не тяжёлое.");
    }
    const { showAttackDialog } = await import("../sheets/attack-dialog.mjs");
    return showAttackDialog(actor, item, { freeShot: kind });
  }
  if (kind === FREE_SHOT_KINDS.runAndGun || kind === FREE_SHOT_KINDS.bayonetCharge) {
    const label = kind === FREE_SHOT_KINDS.runAndGun ? "Стрельба на Бегу" : "Штыковая Атака";
    const flag = kind === FREE_SHOT_KINDS.runAndGun ? RUN_AND_GUN_PENDING_FLAG : BAYONET_SHOT_PENDING_FLAG;
    if (!actor.getFlag?.(NS, flag)) return ui.notifications?.warn(`${label}: выстрел уже сделан или Ход закончился.`);
    const item = itemId && actor.items.get(itemId);
    const eligible = kind === FREE_SHOT_KINDS.runAndGun ? runAndGunEligibleWeapon : bayonetShotEligibleWeapon;
    if (!item || !item.system?.equipped || !eligible(item)) {
      return ui.notifications?.warn(`${label}: нужно экипированное ${kind === FREE_SHOT_KINDS.runAndGun ? "не-тяжёлое оружие" : "огнестрельное оружие (Пистолет или Ручное)"}.`);
    }
    const { showAttackDialog } = await import("../sheets/attack-dialog.mjs");
    return showAttackDialog(actor, item, { freeShot: kind });
  }
  if (kind === FREE_SHOT_KINDS.runningThrow) {
    if (!actor.getFlag?.(NS, RUNNING_THROW_PENDING_FLAG)) return ui.notifications?.warn("Бросок на Бегу: бросок уже сделан или Ход закончился.");
    const item = itemId && actor.items.get(itemId);
    if (!item || !runningThrowEligibleWeapon(item)) return ui.notifications?.warn("Бросок на Бегу: нужно метательное оружие или граната (бомбой нельзя).");
    const { showAttackDialog } = await import("../sheets/attack-dialog.mjs");
    return showAttackDialog(actor, item, { freeShot: kind });
  }
  if (kind === FREE_SHOT_KINDS.drawFire) {
    const item = actor.items.get(itemId);
    if (!item) return ui.notifications?.warn("Огонь с Вытягивания: пистолет не найден.");
    if (!isRoundCapabilityAvailable(actor, DRAW_FIRE_ROUND_FLAG)) return ui.notifications?.warn("Огонь с Вытягивания: в этом Раунде уже использован.");
    // «Раз в Раунд» отмечается, когда выстрел реально сделан (sheets/attack/dialog.mjs → consumeFreeShot),
    // а не при открытии окна: отмена окна использование не сжигает.
    const { showAttackDialog } = await import("../sheets/attack-dialog.mjs");
    return showAttackDialog(actor, item, { freeShot: kind });
  }
}

/**
 * Почему бесплатный выстрел сейчас нельзя ("" — можно). Окно могли открыть дважды, поэтому условия
 * перепроверяются на самом броске, а не только на кнопке.
 */
export function freeShotBlockReason(actor, kind) {
  if (kind === FREE_SHOT_KINDS.hipShooting && !actor.getFlag?.(NS, HIP_SHOOTING_FLAG)) return "Стрельба от Бедра: выстрел уже сделан";
  if (kind === FREE_SHOT_KINDS.drawFire && !isRoundCapabilityAvailable(actor, DRAW_FIRE_ROUND_FLAG)) return "Огонь с Вытягивания: в этом Раунде уже использован";
  if (kind === "coveringFire" && !actor.getFlag?.(NS, COVERING_FIRE_OFFER_FLAG)) return "Прикрывающий Огонь: очередь уже сделана";
  if (kind === FREE_SHOT_KINDS.runAndGun && !actor.getFlag?.(NS, RUN_AND_GUN_PENDING_FLAG)) return "Стрельба на Бегу: выстрел уже сделан";
  if (kind === FREE_SHOT_KINDS.bayonetCharge && !actor.getFlag?.(NS, BAYONET_SHOT_PENDING_FLAG)) return "Штыковая Атака: выстрел уже сделан";
  if (kind === FREE_SHOT_KINDS.runningThrow && !actor.getFlag?.(NS, RUNNING_THROW_PENDING_FLAG)) return "Бросок на Бегу: бросок уже сделан";
  return "";
}

/**
 * Выстрел сделан: Огонь с Вытягивания отмечает Раунд, Стрельба от Бедра снимает метку;
 * Стрельба на Бегу снимает метку и запирает оружие в рукопашной до Сложить; Штыковая Атака снимает метку.
 */
export async function consumeFreeShot(actor, kind, item = null) {
  if (kind === FREE_SHOT_KINDS.drawFire) await markRoundCapabilityUsed(actor, DRAW_FIRE_ROUND_FLAG);
  if (kind === FREE_SHOT_KINDS.hipShooting) await consumeHipShooting(actor);
  if (kind === FREE_SHOT_KINDS.runAndGun) {
    await actor.unsetFlag(NS, RUN_AND_GUN_PENDING_FLAG);
    if (item?.id) await actor.setFlag(NS, RUN_AND_GUN_FIRED_FLAG, item.id);
  }
  if (kind === FREE_SHOT_KINDS.bayonetCharge) await actor.unsetFlag(NS, BAYONET_SHOT_PENDING_FLAG);
  if (kind === FREE_SHOT_KINDS.runningThrow) await actor.unsetFlag(NS, RUNNING_THROW_PENDING_FLAG);
}

/** Выстрел Стрельбы от Бедра сделан — снять метку (вызывает окно атаки после списания). */
export async function consumeHipShooting(actor) {
  if (actor?.getFlag?.(NS, HIP_SHOOTING_FLAG)) await actor.unsetFlag(NS, HIP_SHOOTING_FLAG);
}

// module/combat/payback.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Payback / Расплата (Талант Дредноутов, Книга Машин стр. 58; Разобрать r8b8m).
//  Книга: «Когда ненавистный противник наносит Дредноуту или пилоту
//  непоглощённый урон, пилот может потратить Реакцию и немедленно атаковать
//  этого противника одним орудием на выбор. Не работает при Здравомыслии 20 и
//  ниже.»
//
//  Цепочка урона (combat/damage.mjs) после всех слоёв поглощения спрашивает
//  paybackOfferHtml: если условия сошлись, на карточке урона появляется кнопка.
//  Клик списывает Реакцию пилота и наводит его на обидчика — дальше обычная
//  атака с листа (тот же приём, что у Свободной атаки, combat/free-attack.mjs).
// ════════════════════════════════════════════════════════════════════════════

import { esc } from "../helpers/utils.mjs";
import { itemHasName, hatredTargetsOf } from "../rules/predicates.mjs";
import { anyTargetMatches } from "../rules/talent-targets.mjs";
import { isDreadnought, pilotUuidOf } from "../rules/dreadnought.mjs";
import { canSpendReaction, spendReaction, hasActionEconomy } from "./action-economy.mjs";

/** Порог Здравомыслия: при 20 и ниже Талант не работает. */
export const PAYBACK_SANITY_FLOOR = 20;

export function hasPayback(actor) {
  return [...(actor?.items ?? [])].some(i => i?.type === "talent"
    && (itemHasName(i, "Payback") || itemHasName(i, "Расплата")));
}

/** Пилот, который отвечает: у Дредноута — назначенный пилот, иначе сам пострадавший. */
export function paybackPilotOf(damaged, resolveUuid = (u) => globalThis.fromUuidSync?.(u) ?? null) {
  if (!damaged) return null;
  if (isDreadnought(damaged)) {
    const uuid = pilotUuidOf(damaged);
    return uuid ? resolveUuid(uuid) : null;
  }
  return damaged;
}

/**
 * Сработает ли Расплата — без побочных эффектов.
 * @returns {{ok:boolean, pilot:object|null, reason:string}}
 */
export function paybackCheck(damaged, attacker, netDamage, { resolveUuid } = {}) {
  const fail = (reason, pilot = null) => ({ ok: false, pilot, reason });
  if (!(Number(netDamage) > 0) || !attacker) return fail("");
  const pilot = paybackPilotOf(damaged, resolveUuid);
  if (!pilot || !hasPayback(pilot)) return fail("");
  if (attacker === pilot || attacker === damaged) return fail("");
  const targets = hatredTargetsOf(pilot);
  if (!targets.length || !anyTargetMatches(targets, { targetActor: attacker })) return fail("");
  const sanity = Number(pilot.system?.sanity?.value);
  if (Number.isFinite(sanity) && sanity <= PAYBACK_SANITY_FLOOR) {
    return fail(`Расплата: Здравомыслие ${sanity} — ${PAYBACK_SANITY_FLOOR} и ниже, Талант не работает.`, pilot);
  }
  return { ok: true, pilot, reason: "" };
}

/** HTML кнопки для карточки урона (или подпись, почему нет). Пустая строка — молчать. */
export function paybackOfferHtml(damaged, attacker, netDamage, opts = {}) {
  const c = paybackCheck(damaged, attacker, netDamage, opts);
  if (!c.ok) return c.reason ? `<div class="dmg-tb-note">${esc(c.reason)}</div>` : "";
  if (hasActionEconomy(c.pilot) && !canSpendReaction(c.pilot)) {
    return `<div class="dmg-tb-note">Расплата: у ${esc(c.pilot.name)} не осталось Реакции.</div>`;
  }
  return `<div class="dmg-tb-note">Расплата: ${esc(attacker.name)} — Ненавистный враг.
    <button class="wh-payback-btn" type="button" data-pilot-uuid="${esc(c.pilot.uuid)}" data-attacker-uuid="${esc(attacker.uuid)}">
      Ответить атакой (−1 Реакция)
    </button></div>`;
}

/** Клик: Реакция пилота, обидчик — цель. Атаку игрок наносит с листа одним орудием. */
export async function resolvePaybackClick(pilotUuid, attackerUuid) {
  const pilot = await fromUuid(pilotUuid).catch(() => null);
  if (!pilot) return false;
  if (!pilot.isOwner) { ui.notifications.warn("⚠️ Нет прав на пилота."); return false; }
  if (hasActionEconomy(pilot) && !await spendReaction(pilot)) {
    ui.notifications.warn(`⚠️ ${pilot.name}: не хватает Реакции.`);
    return false;
  }
  const attacker = await fromUuid(attackerUuid).catch(() => null);
  const token = attacker?.getActiveTokens?.()?.[0] ?? null;
  if (token && canvas?.ready) token.setTarget(true, { user: game.user, releaseOthers: true });
  ui.notifications.info(`${pilot.name}: Расплата — атакуйте ${attacker?.name ?? "обидчика"} одним орудием на выбор.`);
  return true;
}

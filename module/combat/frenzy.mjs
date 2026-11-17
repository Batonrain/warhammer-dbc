// module/combat/frenzy.mjs
// ════════════════════════════════════════════════════════════════════════
//  Ярость (Талант Frenzy, module/constants/talents-library.mjs) — книжный
//  текст: «Выход из Ярости — тест W+0 (1 попытка/Ход) или потеря сознания;
//  после боя +10 за каждый Ход. Однажды выйдя из Ярости, персонаж не может
//  снова войти в нее до конца боя, кроме как с помощью наркотиков или
//  психосил.» (wdbc-sk8s, wdbc-sh3qt).
//
//  system.inRage — простой тумблер (см. templates/actor/parts/tab-combat.hbs).
//  Поведение Ярости (запрет Избеганий и речи, тест W+0 на выход, напоминание
//  «двигаться к врагу») — combat/rage-behavior.mjs; успешный выход оттуда
//  зовёт markFrenzyExited ниже. Здесь только ОДНО правило книги — лимит на
//  ПОВТОРНЫЙ ВХОД, и он ОБЩИЙ: действует на любую Ярость любого актора
//  (решение владельца, wdbc-sh3qt), а не только на владельцев Frenzy.
//
//  Метка выхода (markFrenzyExited) пишется, когда Ярость снята любым путём
//  (хук updateActor в hooks.mjs) и при успешном выходе кнопкой. Вход гейтится
//  в ОДНОМ месте — blockRageReentry, его зовёт preUpdateActor в
//  warhammer-dbc.mjs: так лимит видят все источники Ярости (тумблер листа,
//  Кхорнгор, Икона Богохульства, Скорый на Гнев, Миролюбец), а не каждый
//  по отдельности. Исключения книги — наркотики и психосилы: их update
//  помечает options.whRageSource = "drug" | "psychic" (галлюциногены,
//  Первобытный Вой), и гейт их пропускает.
//
//  Butcher's Nails / Гвозди Мясника (Черта, элитный архетип Берсерк Кхорна)
//  снимает лимит целиком: «Может входить в Ярость свободным действием,
//  неограниченное число раз за бой.»
//
//  Цена входа в ОД (frenzyEntryApCost) по-прежнему только у владельцев
//  Таланта Frenzy — для остальных книга цены не называет.
// ════════════════════════════════════════════════════════════════════════

import { isCapabilityAvailable, markCapabilityUsed } from "../rules/cooldown.mjs";
import { hasAbility } from "../rules/ability-by-key.mjs";
import { itemHasName } from "../rules/predicates.mjs";
import { spendActionPoints, isEncounterActive, hasActionEconomy } from "./action-economy.mjs";
import { esc } from "../helpers/utils.mjs";

const FLAG = "frenzyReentry";

export const RAGE_SOURCE_OPTION = "whRageSource";
const RAGE_EXEMPT_SOURCES = ["drug", "psychic"];

export function hasFrenzyTalent(actor) {
  return hasAbility(actor, "ability.frenzy", "Frenzy", "talent");
}

/** Butcher's Nails / Гвозди Мясника — снимает лимит повторного входа целиком. */
export function hasButchersNails(actor) {
  return hasAbility(actor, "ability.butchersNails", "Butcher's Nails", "trait");
}

/** Заблокирован ли ПОВТОРНЫЙ вход в Ярость в этом бою (уже выходил раньше). */
export function frenzyEntryBlocked(actor) {
  if (hasButchersNails(actor)) return false;
  return !isCapabilityAvailable(actor, FLAG, "battle");
}

/** Отмечает выход из Ярости — со следующего входа в этом бою сработает лимит. */
export async function markFrenzyExited(actor) {
  if (hasButchersNails(actor) || frenzyEntryBlocked(actor)) return;
  await markCapabilityUsed(actor, FLAG, "battle");
}

const reentryReason = actor => `«${actor.name}» уже выходил(а) из Ярости в этом бою — повторный вход запрещён до конца боя. Снимается Чертой Butcher's Nails / Гвозди Мясника; наркотики и психосилы лимит обходят.`;

/**
 * Гейт на правку system.inRage:true (preUpdateActor): после выхода из Ярости повторный вход в этом бою закрыт
 * любому актору. Вычищает inRage из правки, предупреждает того, кто правил, и пишет причину в чат — иначе
 * карточка источника («впадает в Ярость») осталась бы без объяснения, почему Ярости нет.
 * @returns {boolean} true — вход заблокирован
 */
export function blockRageReentry(actor, changes, options = {}) {
  if (changes?.system?.inRage !== true || actor?.system?.inRage === true) return false;
  if (RAGE_EXEMPT_SOURCES.includes(options?.[RAGE_SOURCE_OPTION])) return false;
  if (!frenzyEntryBlocked(actor)) return false;
  delete changes.system.inRage;
  const reason = reentryReason(actor);
  ui.notifications?.warn(reason);
  ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="wh-roll-result"><div class="roll-header">🔒 Ярость — ${esc(actor.name)}</div><div class="roll-threshold">${esc(reason)}</div></div>`
  }).catch(() => {});
  return true;
}

/** Огонь в Крови / Fire in Blood: «может войти в Ярость за полудействие». */
export function hasFireInBlood(actor) {
  return hasAbility(actor, "berserker.core.fireInBlood", "Fire in Blood", "talent");
}

/**
 * Цена входа в Ярость в ОД: полное действие (2), с Огнём в Крови — полудействие (1), с Гвоздями Мясника — свободное (0).
 * Вне боя и без экономики действий платить нечем — 0.
 */
export function frenzyEntryApCost(actor) {
  if (!hasFrenzyTalent(actor) || hasButchersNails(actor)) return 0;
  if (!isEncounterActive() || !hasActionEconomy(actor)) return 0;
  return hasFireInBlood(actor) ? 1 : 2;
}

/**
 * Вход в Ярость тумблером листа: повторный вход в бою закрыт (frenzyEntryBlocked), иначе у владельца Frenzy вход
 * стоит ОД (frenzyEntryApCost). Сам тумблер переключает вызывающая сторона.
 * @returns {Promise<{ok:boolean, reason?:string, cost?:number}>}
 */
export async function tryEnterRage(actor) {
  if (frenzyEntryBlocked(actor)) return { ok: false, reason: reentryReason(actor) };
  const cost = frenzyEntryApCost(actor);
  if (cost > 0 && !await spendActionPoints(actor, cost, { physical: true })) {
    return { ok: false, reason: `«${actor.name}»: не хватает ОД на вход в Ярость (${cost === 1 ? "полудействие, Огонь в Крови" : "полное действие"}).` };
  }
  return { ok: true, cost };
}

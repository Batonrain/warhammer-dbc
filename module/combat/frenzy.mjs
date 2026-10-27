// module/combat/frenzy.mjs
// ════════════════════════════════════════════════════════════════════════
//  Ярость (Талант Frenzy, module/constants/talents-library.mjs) — книжный
//  текст: «Выход из Ярости — тест W+0 (1 попытка/Ход) или потеря сознания;
//  после боя +10 за каждый Ход. Однажды выйдя, нельзя войти снова до конца
//  боя, кроме как наркотиками/психосилами.» (wdbc-sk8s).
//
//  system.inRage — простой тумблер (см. templates/actor/parts/tab-combat.hbs).
//  Поведение Ярости (запрет Избеганий и речи, тест W+0 на выход, напоминание
//  «двигаться к врагу») — combat/rage-behavior.mjs; успешный выход оттуда
//  зовёт markFrenzyExited ниже. Здесь только ОДНО правило книги — лимит на
//  ПОВТОРНЫЙ ВХОД. Он проверяется на тумблере листа у владельцев Frenzy; прочие
//  источники Ярости (Кхорнгор, галлюциногены, Икона Богохульства, Первобытный
//  Вой, Скорый на Гнев, Миролюбец) его не спрашивают — «наркотики и психосилы»
//  в книге исключение, а остальное решение владельца не покрыто. Обход лимита
//  наркотиком/психосилой как отдельная ветка не заведён — только Черта.
//
//  Butcher's Nails / Гвозди Мясника (Черта, элитный архетип Берсерк Кхорна)
//  снимает лимит целиком: «Может входить в Ярость свободным действием,
//  неограниченное число раз за бой.»
//
//  Ограничение применяется ТОЛЬКО владельцам Таланта Frenzy — system.inRage
//  используется и другими источниками (мутации и т.п.), для которых этого
//  правила книга не пишет; расширять лимит на них было бы самоуправством.
// ════════════════════════════════════════════════════════════════════════

import { isCapabilityAvailable, markCapabilityUsed } from "../rules/cooldown.mjs";
import { hasAbility } from "../rules/ability-by-key.mjs";
import { itemHasName } from "../rules/predicates.mjs";

const FLAG = "frenzyReentry";

function hasFrenzyTalent(actor) {
  return hasAbility(actor, "ability.frenzy", "Frenzy", "talent");
}

/** Butcher's Nails / Гвозди Мясника — снимает лимит повторного входа целиком. */
export function hasButchersNails(actor) {
  return hasAbility(actor, "ability.butchersNails", "Butcher's Nails", "trait");
}

/** Заблокирован ли ПОВТОРНЫЙ вход в Ярость в этом бою (уже выходил раньше). */
export function frenzyEntryBlocked(actor) {
  if (!hasFrenzyTalent(actor) || hasButchersNails(actor)) return false;
  return !isCapabilityAvailable(actor, FLAG, "battle");
}

/** Отмечает выход из Ярости — со следующего входа в этом бою сработает лимит. */
export async function markFrenzyExited(actor) {
  if (!hasFrenzyTalent(actor) || hasButchersNails(actor)) return;
  await markCapabilityUsed(actor, FLAG, "battle");
}

// module/combat/frenzy.mjs
// ════════════════════════════════════════════════════════════════════════
//  Ярость (Талант Frenzy, module/constants/talents-library.mjs) — книжный
//  текст: «Выход из Ярости — тест W+0 (1 попытка/Ход) или потеря сознания;
//  после боя +10 за каждый Ход. Однажды выйдя, нельзя войти снова до конца
//  боя, кроме как наркотиками/психосилами.» (wdbc-sk8s).
//
//  system.inRage — простой тумблер (см. templates/actor/parts/tab-combat.hbs,
//  комментарий «сама механика Ярости не реализована» — вынужденное движение
//  к врагу, авто-провал соц. тестов, тест W+0 на выход и т.п. сюда НЕ входят,
//  это отдельный больший объём, здесь только ОДНО правило книги — лимит на
//  ПОВТОРНЫЙ ВХОД. Наркотики/психосилы как обход лимита тоже не реализованы
//  (не встретилось готового хука на «этот конкретный наркотик/психосилу
//  применили» именно для снятия ЭТОГО ограничения) — только Черта.
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
import { itemHasName } from "../rules/predicates.mjs";

const FLAG = "frenzyReentry";

function hasFrenzyTalent(actor) {
  return !!actor?.items?.some(i => i.type === "talent" && itemHasName(i, "Frenzy"));
}

/** Butcher's Nails / Гвозди Мясника — снимает лимит повторного входа целиком. */
export function hasButchersNails(actor) {
  return !!actor?.items?.some(i => i.type === "trait" && itemHasName(i, "Butcher's Nails"));
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

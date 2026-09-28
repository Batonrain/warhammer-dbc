// module/rules/fated-path.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Черта Нумена «Fated Path / Предначертанный Путь» (корбук, Архетипы Людей):
//
//    «При создании персонажа, Нумен выбирает один Элитный Архетип. …
//     Нумен получает скидку в 1000xp на избранный им Элитный Архетип, всегда
//     берет его по базовой цене, и этот Архетип не увеличивает цену других
//     Элитных Архетипов».
//
//  Выбор хранится на акторе меткой flags.warhammer-dbc.fatedPath (имя
//  Элитного Архетипа), действует, пока у актора есть возможность Черты
//  (trait.fatedPath, выдаётся Конструктором Черты). Счёт цены — здесь, чистыми
//  функциями; покупка и пикер (apps/elite-buy.mjs, sheets/elite-picker.mjs)
//  зовут их. «Не должен сюжетно обосновывать … узнать об Архетипе или о
//  Становлении» — требования «проверяет ГМ» у избранного Архетипа пикер
//  показывает выполненными, а окно покупки о них не спрашивает.
// ════════════════════════════════════════════════════════════════════════════

import { hasRuleFlag } from "./flags.mjs";

export const FATED_PATH = "trait.fatedPath";
export const FATED_FLAG = "fatedPath";
export const FATED_DISCOUNT = 1000;

/** Имя избранного Элитного Архетипа или "" (нет Черты / ещё не выбран). */
export function fatedEliteName(actor) {
  const name = actor?.flags?.["warhammer-dbc"]?.[FATED_FLAG];
  if (!name || typeof name !== "string") return "";
  return hasRuleFlag(actor, FATED_PATH) ? name : "";
}

/** Есть ли у актора Черта (выбор ещё можно сделать или уже сделан). */
export function hasFatedPath(actor) {
  return hasRuleFlag(actor, FATED_PATH);
}

/** Этот Элитный Архетип — избранный? */
export function isFatedElite(actor, doc) {
  const fated = fatedEliteName(actor);
  return !!fated && String(doc?.name ?? "") === fated;
}

/** Цена избранного: базовая минус 1000, не ниже 0 — без множителя за взятые. */
export function fatedEliteCost(base) {
  return Math.max(0, (Number(base) || 0) - FATED_DISCOUNT);
}

/** Сколько взятых Элитных Архетипов поднимает цену: избранный не считается. */
export function eliteTakenForPrice(actor) {
  const fated = fatedEliteName(actor);
  return [...(actor?.items ?? [])]
    .filter(i => i.type === "eliteArchetype" && !(fated && i.name === fated)).length;
}

/** Куплен ли уже избранный — после этого выбор не меняется. */
export function fatedEliteTaken(actor) {
  const fated = fatedEliteName(actor);
  return !!fated && [...(actor?.items ?? [])].some(i => i.type === "eliteArchetype" && i.name === fated);
}

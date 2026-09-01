// module/rules/plague-shepherd.mjs
//
// Мутация «Plague Shepherd / Чумной Пастырь» (wdbc-w8ws, Дары Нургл d100
// 67…69): «Когда персонаж использует Команду или Брифинг, подчинённые с
// покровительством Нургла дополнительно получают Успехи аблативных Ран
// (не складываются с Ранами от его предыдущих команд)». И Команды, и
// Брифинг живут целиком в sheets/squad-sheet.mjs (не пишутся на подчинённых
// — см. rules/command.mjs про «состояние живёт у отдающего»), поэтому вся
// Foundry-обвязка (резолв командира/подчинённых, actor.update) — там же;
// здесь только чистая идентификация и арифметика.
//
// Собственный вклад подчинённого хранится флагом
// flags.warhammer-dbc.plagueShepherdAblative и двигается ВМЕСТЕ с
// ablativeMax (см. cancerous-healing.mjs про клэмп #291 — та же причина).

import { itemHasName } from "./predicates.mjs";
import { replaceAblativeContribution, shrinkAblativeContributionToFit } from "./wounds.mjs";

const NAME = "Plague Shepherd";
export const PLAGUE_SHEPHERD_FLAG = "plagueShepherdAblative";

/** Это предмет-Мутация «Чумной Пастырь»? */
export function isPlagueShepherdItem(item) {
  return item?.type === "mutation" && itemHasName(item, NAME);
}

/** Владеет ли актор Мутацией «Чумной Пастырь». */
export function hasPlagueShepherd(actor) {
  return !!actor?.items?.some(i => isPlagueShepherdItem(i));
}

/**
 * Новый вклад подчинённого = Успехи текущей команды, ЗАМЕНЯЕТ вклад прошлой
 * (RAW: «не складываются с Ранами от его предыдущих команд»), не трогая
 * посторонний аблатив на том же акторе (Absurdly Fat и т.п.).
 *
 * @param {object} system            подчинённого actor.system
 * @param {number} prevContribution  флаг PLAGUE_SHEPHERD_FLAG подчинённого
 * @param {number} sux                Успехи текущей команды
 * @returns {{newAblative:number, newAblativeMax:number, contribution:number}}
 */
export function plagueShepherdGrant(system, prevContribution, sux) {
  const newContribution = Math.max(0, Number(sux) || 0);
  const { ablative, ablativeMax, contribution } = replaceAblativeContribution(system, prevContribution, newContribution);
  return { newAblative: ablative, newAblativeMax: ablativeMax, contribution };
}

/**
 * Ресинк ПОСЛЕ того, как общий ablative пул подчинённого уменьшился по
 * другой причине (поглощение урона) — см.
 * module/rules/wounds.mjs::shrinkAblativeContributionToFit.
 */
export function plagueShepherdShrinkToFit(system, prevContribution) {
  return shrinkAblativeContributionToFit(system, prevContribution);
}

/**
 * Foundry-обвязка ресинка выше — вызывать из хука updateActor (warhammer-dbc.mjs)
 * при изменении system.wounds.ablative ЛЮБОГО актора (см. cancerous-healing.mjs
 * про ту же причину — клэмп #291 в rules/character.mjs).
 */
export async function reconcilePlagueShepherdToFit(actor) {
  const FLAG = "warhammer-dbc";
  const prev = Number(actor.getFlag(FLAG, PLAGUE_SHEPHERD_FLAG)) || 0;
  if (prev <= 0) return;
  const result = plagueShepherdShrinkToFit(actor.system, prev);
  if (!result) return;
  await actor.update({
    "system.wounds.ablativeMax": result.ablativeMax,
    [`flags.${FLAG}.${PLAGUE_SHEPHERD_FLAG}`]: result.contribution
  });
}

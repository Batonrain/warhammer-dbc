// module/rules/living-banner.mjs
// Living Banner / Живой Стяг (Черта Герольда; Разобрать lg5r8). Чистая часть без Foundry.
// Книга: «В свой Ход может потратить Очко Бесчестия, чтобы пройти тест Command(F)+10 или
// Charm(F)+10 и восстановить одно ранее потраченное Очко Бесчестия всем соратникам, кто могут
// его видеть или слышать. Не может использовать Трейт, если геральдика запятнана и не видна…»
// Условие о геральдике ведёт стол. Бросок и раздача — combat/living-banner.mjs.

import { itemHasName } from "./predicates.mjs";

export const LIVING_BANNER_MOD = 10;

export function hasLivingBanner(actor) {
  return [...(actor?.items ?? [])].some(i => i?.type === "trait"
    && (itemHasName(i, "Living Banner") || itemHasName(i, "Живой Стяг")));
}

/** Навык броска: тот из Command/Charm, что выше (книга даёт выбор). */
export function livingBannerSkill(actor) {
  const sk = actor?.system?.skills ?? {};
  const command = Number(sk.command?.total) || 0;
  const charm = Number(sk.charm?.total) || 0;
  return charm > command ? { key: "charm", label: "Charm", total: charm } : { key: "command", label: "Command", total: command };
}

/** Кому вернуть Очко: только тем, у кого есть потраченные (текущее ниже максимума). */
export function livingBannerRecipients(allies, { value, max }) {
  return (allies ?? []).filter(a => (Number(value(a)) || 0) < (Number(max(a)) || 0));
}

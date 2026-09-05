// module/rules/flayed.mjs
//
// Мутация «Flayed / Освежёванный» (wdbc-w8ws, Общие мутации d100 45): статика
// (−5 максимум Ран) уже отыграна обычной записью Конструктора kind:"wounds"
// (packs-src/mutations/Общие_мутации/Flayed...). Здесь — динамическая часть:
// «минута работы + нож на другом разумном существе» даёт 3+Размер донора
// аблативных Ран, максимум 3×Cor.b суммарно. Конструктор не умеет читать
// Размер ВЫБРАННОЙ на месте цели, поэтому бэспоук, тем же приёмом, что
// Cancerous Healing/Hand of Death.
//
// Собственный вклад в общий аблативный пул хранится флагом
// flags.warhammer-dbc.flayedAblative и двигается ВМЕСТЕ с ablativeMax
// (module/rules/wounds.mjs::replaceAblativeContribution) — см. докстринг
// cancerous-healing.mjs про клэмп #291, ровно та же причина.

import { itemHasName, sizeOf } from "./predicates.mjs";
import { itemIs } from "./item-marker.mjs";
import { replaceAblativeContribution, shrinkAblativeContributionToFit } from "./wounds.mjs";

const NAME = "Flayed";
export const FLAYED_FLAG = "flayedAblative";

/** Это предмет-Мутация «Освежёванный»? */
export function isFlayedItem(item) {
  return itemIs(item, "mutation", "mutation.flayed", NAME);
}

/**
 * Прибавка аблативных Ран от содранной кожи одного донора, с учётом потолка
 * 3×Cor.b актора-владельца кожи. Копится с уже имеющейся кожей (несколько
 * доноров складываются), не заменяет.
 *
 * @param {object} wearerSystem     system актора, который нацепляет кожу
 * @param {number} prevContribution текущий флаг FLAYED_FLAG владельца
 * @param {Actor}  donorActor       актор, с которого содрана кожа (для Размера)
 */
export function flayedGrant(wearerSystem, prevContribution, donorActor) {
  const corBonus = Number(wearerSystem?.corruptionBonus) || 0;
  const cap       = 3 * corBonus;
  const donorSize = sizeOf(donorActor);
  const add       = 3 + Math.max(0, donorSize);
  const newContribution = Math.max(0, Math.min(cap, (Number(prevContribution) || 0) + add));
  const { ablative, ablativeMax, contribution } = replaceAblativeContribution(wearerSystem, prevContribution, newContribution);
  return {
    newAblative: ablative, newAblativeMax: ablativeMax, contribution,
    granted: contribution - (Number(prevContribution) || 0), cap, add, donorSize
  };
}

/**
 * Ресинк ПОСЛЕ того, как общий ablative пул уменьшился по другой причине
 * (поглощение урона) — см. module/rules/wounds.mjs::shrinkAblativeContributionToFit.
 */
export function flayedShrinkToFit(wearerSystem, prevContribution) {
  return shrinkAblativeContributionToFit(wearerSystem, prevContribution);
}

/**
 * Визуальный порог кожи (стр. описания Мутации, чисто флейвор для чата):
 * 6+ — складки, ниже 5 — истончается/дыры, пока не исчезнет.
 */
export function flayedVisualNote(ablative) {
  const n = Number(ablative) || 0;
  if (n >= 6) return "Кожа собирается заметными складками.";
  if (n < 5)  return "Кожа истончается и покрывается прорехами.";
  return "";
}

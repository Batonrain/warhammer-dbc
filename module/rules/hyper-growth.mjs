// module/rules/hyper-growth.mjs
//
// Боеприпас «Гиперрост» (packs-src/ammunition/Специальные___Болты, wdbc-173l/
// wdbc-utaw): «Даёт Toxic (4); после урона от яда цель получает столько же
// аблативных Ран в ту же часть тела». Единственный во всём аудите «аблатив»
// (wdbc-173l) случай, где грант достаётся ВРАГУ (цели атаки), а не владельцу
// источника — общая инфраструктура replaceAblativeContribution/
// shrinkAblativeContributionToFit (wdbc-w8ws/wdbc-bxw6, ./wounds.mjs)
// рассчитана на «свой источник → своя доля своего пула получателя», здесь
// используется тем же приёмом, просто получатель этой доли — не владелец
// боеприпаса, а цель, в которую он попал.
//
// «В ту же часть тела» в тексте предмета — аблативный пул в этой системе
// актёр-общий (system.wounds.ablative), частей тела не различает вообще
// (module/rules/wounds.mjs) — здесь это не более чем флейвор в чате, реальной
// привязки к зоне попадания нет и не моделируется.
//
// НЕ смоделировано (см. текст предмета и wdbc-utaw, честно, тем же приёмом,
// что Reactive Plates/Reformation Song, wdbc-bxw6): пока держатся эти
// аблативные Раны, цель перебрасывает успешные физические тесты поражённой
// частью; опухоли на Торсе мешают двуручному оружию, на Голове — ослепляют.
// GM-адъюдикация за столом, автоматики для этой части нет.

import { itemHasName } from "./predicates.mjs";
import { replaceAblativeContribution, shrinkAblativeContributionToFit } from "./wounds.mjs";

const AMMO_NAME = "Гиперрост";
export const HYPER_GROWTH_FLAG = "hyperGrowthAblative";

/**
 * Это тик яда именно от боеприпаса «Гиперрост»? Сравнение по имени —
 * itemHasName ожидает предмет (несёт .name), поэтому оборачиваем голое имя
 * из data-атрибута кнопки в {name}, тем же двуязычным сравнением, что и
 * остальные бэспоук-предметы в rules/ (Blood Shield, Flayed и т.п.).
 */
export function isHyperGrowthAmmoName(ammoName) {
  return itemHasName({ name: ammoName }, AMMO_NAME);
}

/**
 * Тик яда от Гиперроста нанёс `dmg` непоглощаемого урона цели — она получает
 * столько же аблативных Ран. Копится с уже имеющимися от Гиперроста (не
 * заменяет), потолка книга не задаёт.
 *
 * @param {object} targetSystem     actor.system ЦЕЛИ (получателя аблатива)
 * @param {number} prevContribution текущий флаг HYPER_GROWTH_FLAG цели
 * @param {number} dmg               урон яда, только что нанесённый этим тиком
 * @returns {{ablative:number, ablativeMax:number, contribution:number, granted:number}|null}
 *   null — dmg ≤ 0, гранта нет
 */
export function hyperGrowthGrant(targetSystem, prevContribution, dmg) {
  const add = Math.max(0, Number(dmg) || 0);
  if (add <= 0) return null;
  const prev = Math.max(0, Number(prevContribution) || 0);
  const next = prev + add;
  const { ablative, ablativeMax, contribution } = replaceAblativeContribution(targetSystem, prev, next);
  return { ablative, ablativeMax, contribution, granted: contribution - prev };
}

/**
 * Ресинк ПОСЛЕ того, как общий ablative пул цели уменьшился по другой причине
 * (поглощение боевого урона) — см. rules/wounds.mjs::shrinkAblativeContributionToFit.
 */
export function hyperGrowthShrinkToFit(targetSystem, prevContribution) {
  return shrinkAblativeContributionToFit(targetSystem, prevContribution);
}

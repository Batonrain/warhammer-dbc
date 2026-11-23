// module/rules/autosense-jacks.mjs
// ════════════════════════════════════════════════════════════════════════════
//  ПОРТЫ АВТОЧУВСТВ / Autosense Jacks (core, «Модификации → Прочие», стр. 200;
//  Sahara 10 / dbc-87, п.2): «Оружие можно за полное действие присоединить
//  проводами к разъемам на наруче силовой брони и передавать фид с его прицелов
//  прямо на ретинальный дисплей авточувств (если они есть). Позволяет получать
//  преимущества прицелов, которые обычно требуют Полу-прицеливания или Полного
//  Прицеливания, и без прицеливания… При складывании оружия провода
//  отстреливаются… при каждом их взятии оружия в руки нужно вставлять заново».
//
//  «Подключено» — тумблер мода (activatable/active, та же пара, что у систем
//  силовой брони, AGENTS.md → «Активация записи Конструктора»). «Если они
//  есть» — requiresWorn: ["Autosenses"] в паке: без Авточувств мод выпадает из
//  getActiveMods (combat/weapon-mods.mjs::modWornRequirementMet), как
//  Целеуказатель без дисплея.
//
//  Читатели «(прицеливание)» у прицелов (окно атаки: Коллиматорный, Оптический/
//  Джинн, Термальный, Предсказатель) спрашивают sightAiming вместо голого
//  system.aiming — прочие бонусы Прицеливания (+10/+20 к попаданию) порты НЕ
//  дают: книга говорит о «преимуществах прицелов».
//
//  Чистая логика без Foundry; импорт — только item-marker (круга через
//  rules/sources.mjs нет).
// ════════════════════════════════════════════════════════════════════════════

import { itemIs } from "./item-marker.mjs";

// Английская половина имени в паке — «Auto-senses Ports» (в книге — «Autosense Jacks»;
// так в паке не называется, поэтому опознание только по имени пака).
const JACKS_NAMES = ["Auto-senses Ports", "Порты Авточувств"];

/** Порты Авточувств ли этот мод. */
export const isAutosenseJacks = mod => JACKS_NAMES.some(n => itemIs(mod, "weaponMod", null, n));

/** Подключены ли порты среди действующих модов оружия. */
export const jacksLinked = mods => (mods ?? []).some(m => isAutosenseJacks(m) && !!m.system?.active);

/**
 * Прицеливание «для прицелов»: своё, если стрелок целится; при подключённых
 * портах — как Полу-Прицеливание («и без прицеливания»), иначе как есть.
 * @param {object[]} mods  действующие моды оружия (getActiveMods)
 * @param {string} aiming  system.aiming стрелка
 */
export function sightAiming(mods, aiming) {
  if (aiming && aiming !== "none") return aiming;
  return jacksLinked(mods) ? "half" : aiming;
}

/**
 * Подключённые порты этого оружия, которые надо отключить после правки
 * `changes`: оружие убрали из рук («Снаряжено» снято) или в хранение.
 * @returns {object[]} моды-порты к отключению
 */
export function jacksToDisconnect(actor, weapon, changes) {
  const sys = changes?.system ?? {};
  if (!(sys.equipped === false || sys.stored === true)) return [];
  return [...(actor?.items ?? [])].filter(m =>
    isAutosenseJacks(m) && m.system?.installedOn === weapon?.id && !!m.system?.active);
}

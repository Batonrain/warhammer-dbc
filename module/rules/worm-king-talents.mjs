// module/rules/worm-king-talents.mjs
// ════════════════════════════════════════════════════════════════════════
//  Король Червей — Таланты поверх Повелителя Червей (rules/worm-master.mjs).
//  Чистая часть; кнопки — combat/worm-king.mjs.
//
//  • Свободный Скиталец — отпущенный Рой выходит из лимита Cor.b (метка
//    wormReleased на Рое; combat/worm-master.mjs::activeSwarmsOf её не считает).
//  • Метка Опарыша — метка maggotMarkOf = uuid Короля на союзнике.
//  • Стражи Панциря — до трёх «шаблонов» Стражей (метка на Короле).
//  • Червеход — трупы в 7 м от Роя: Рой теряет 5 Ран за каждый, Червеход —
//    −20 ко всем Характеристикам кроме T, T.b×4 Ран.
//  • Рука Изобилия — Cor.b×100 человек.
// ════════════════════════════════════════════════════════════════════════

import { hasItemNamed } from "./req-atom.mjs";

export const WORM_RELEASED_FLAG = "wormReleased";
export const MAGGOT_MARK_FLAG = "maggotMarkOf";
export const SHELL_GUARD_FLAG = "shellGuardTemplates";
export const SHELL_GUARD_TEMPLATES_MAX = 3;
export const WORMWALKER_RADIUS = 7;
export const WORMWALKER_WOUNDS_PER_CORPSE = 5;

export const hasFreeRoamer = a => hasItemNamed(a, "Free Roamer", ["talent"]);
export const hasMaggotMark = a => hasItemNamed(a, "Maggot Mark", ["talent"]);
export const hasShellGuard = a => hasItemNamed(a, "Shell Guard", ["talent"]);
export const hasWormwalker = a => hasItemNamed(a, "Wormwalker", ["talent"]);
export const hasHandOfPlenty = a => hasItemNamed(a, "Hand of Plenty", ["trait"]);

const flagOf = (a, k) => a?.flags?.["warhammer-dbc"]?.[k] ?? a?.getFlag?.("warhammer-dbc", k);

/** Рой отпущен Свободным Скитальцем — в лимит Cor.b не входит. */
export function isReleasedSwarm(swarm) {
  return !!flagOf(swarm, WORM_RELEASED_FLAG);
}

/** Отмечен ли актор Опарышем этого Короля (или любого, если king не задан). */
export function isMaggotMarked(actor, kingUuid = null) {
  const v = flagOf(actor, MAGGOT_MARK_FLAG);
  return !!v && (!kingUuid || v === kingUuid);
}

/** Шаблоны Стражей Панциря Короля. */
export function shellGuardTemplates(king) {
  const v = flagOf(king, SHELL_GUARD_FLAG);
  return Array.isArray(v) ? v : [];
}

/** Можно ли завести Стража этого шаблона: старый шаблон — да, новый — пока их меньше трёх. */
export function shellGuardTemplateOk(king, template) {
  const list = shellGuardTemplates(king);
  return list.includes(template) || list.length < SHELL_GUARD_TEMPLATES_MAX;
}

/** Червеход: сколько трупов Рой «возьмёт» — каждый стоит 5 Ран, ближние раньше, Рой не уходит в ноль. */
export function wormwalkerTake(swarmWounds, corpseCount) {
  const w = Math.max(0, Number(swarmWounds) || 0);
  const n = Math.min(Math.max(0, Number(corpseCount) || 0), Math.floor((w - 1) / WORMWALKER_WOUNDS_PER_CORPSE));
  return { count: Math.max(0, n), woundsLost: Math.max(0, n) * WORMWALKER_WOUNDS_PER_CORPSE };
}

/** Червеход из трупа: −20 ко всем Характеристикам кроме T, T.b×4 Ран. */
export function wormwalkerStats(toughnessBonus) {
  return { charPenalty: -20, wounds: 4 * Math.max(0, Number(toughnessBonus) || 0) };
}

/** Рука Изобилия: коммуна до Cor.b×100 человек. */
export function handOfPlentyPeople(corruptionBonus) {
  return 100 * Math.max(0, Number(corruptionBonus) || 0);
}

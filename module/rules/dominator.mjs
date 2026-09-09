// module/rules/dominator.mjs
// ════════════════════════════════════════════════════════════════════════
//  Dominator / Покоритель (wdbc-u0by, core.json стр. «Талант Purestrain
//  Genestealer» — таблица Оккультиста): «Персонаж получает Преимущество на
//  тесты Демонического Владычества». Владычество — реальный игровой тест
//  (core.json: «тест на W+0 vs W+0», ментальное полное действие), уже
//  проведённый через общий конвейер Ритуала как R.type==="dominion"
//  (module/constants/rituals.mjs::RITUAL_TYPES_MAP, module/apps/
//  ritual-cast.mjs::ritualThreshold — тот же путь порога, что у summon/
//  binding/gate). Безусловна (второго условия, кроме типа ритуала и
//  наличия Таланта, книга не ставит).
// ════════════════════════════════════════════════════════════════════════

import { itemHasName } from "./predicates.mjs";
import { hasAbility } from "./ability-by-key.mjs";
import { ruName } from "../apps/demon-summon.mjs";

export function hasDominator(actor) {
  return hasAbility(actor, "ability.dominator", "Dominator", "talent");
}

/**
 * Свой демон-Оруженосец (wdbc-1rno, шаг E: Инфернальный Оруженосец —
 * «автоматически побеждает во всех тестах Владычества против него»).
 *
 * Владычество (RITUAL_TYPES_MAP.dominion) в движке — обычный ритуал-предмет
 * через общий castRitual, а не отдельный контест с известной целью: демона
 * называет тем же свободным полем «Демон», что и у призыва (R.demonName).
 * Единственный способ узнать «это МОЙ Оруженосец» — сверить это имя с
 * актором-Миньоном, привязанным ИМЕННО ритуалом без теста (armigerBound,
 * тот же флаг, что у демон-оружия — module/apps/armiger-weapon.mjs), у
 * которого масterUuid — сам кастующий. Обычный купленный Миньон (без этого
 * флага) под правило не подпадает — книга говорит конкретно про демона-
 * патрона, а не про любого слугу вообще.
 */
export function isOwnArmiger(actor, demonName) {
  if (!actor?.uuid || !demonName) return false;
  const needle = ruName(demonName).trim().toLowerCase();
  if (!needle) return false;
  return !!game.actors?.find(a =>
    a?.system?.masterUuid === actor.uuid &&
    a?.getFlag?.("warhammer-dbc", "armigerBound") &&
    (ruName(a.name).toLowerCase() === needle || String(a.name || "").toLowerCase() === needle));
}

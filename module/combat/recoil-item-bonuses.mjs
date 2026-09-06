// module/combat/recoil-item-bonuses.mjs
// ════════════════════════════════════════════════════════════════════════
//  Плоские бонусы к пределу Отскока в Раунде от конкретных Талантов/
//  снаряжения (wdbc-9wvm, аудит item'ов из описания тикета) — сведены в
//  одном файле, а не размазаны по core recoil-pool.mjs, тем же принципом
//  разделения, что MELEE_STANCES у Стоек (см. заголовок action-economy.mjs):
//  recoil-pool.mjs остаётся общим движком без имён конкретных предметов,
//  этот файл — их точка входа. Прямая проверка по имени предмета (не через
//  общий реестр rules/sources.mjs), тот же приём, что у witchs-edge.mjs/
//  resplendent-raiment.mjs — не любой численный бонус стоит тащить через
//  общую Конструктор-Механику ради одного потребителя (см. заголовок
//  recoil-pool.mjs и doombc-mechanics-honesty-ratchet).
// ════════════════════════════════════════════════════════════════════════

import { itemHasName } from "../rules/predicates.mjs";
import { hasAbility } from "../rules/ability-by-key.mjs";
import { hasRuleFlag } from "../rules/flags.mjs";
import { equippedMeleeWeapon } from "./equipped-melee.mjs";

const ARMOR_LOCATIONS = ["head", "body", "rightArm", "leftArm", "rightLeg", "leftLeg"];

/** Salto/Сальто (Талант, стр. 12): +P.b м к пределу Отскока в Раунде. */
function saltoBonus(actor) {
  const has = hasAbility(actor, "ability.salto", "Salto", "talent");
  if (!has) return 0;
  return Number(actor?.system?.characteristics?.per?.bonus) || 0;
}

/**
 * Flip Belt/Ремень Кувырков (снаряжение, стр. 12): +3 м к SPD в расчёте
 * Отскока. Снаряжение в этом проекте не несёт поля «надето» (module/data/
 * item/gear.mjs — только описательное system.worn, «куда» а не «сейчас ли»)
 * — как и остальные пассивные бонусы снаряжения здесь, считается по самому
 * факту владения предметом.
 */
function flipBeltBonus(actor) {
  const has = hasAbility(actor, "ability.flipBelt", "Flip Belt", "gear");
  return has ? 3 : 0;
}

/** Сумма всех плоских бонусов предметов к пределу Отскока в Раунде. */
export function recoilItemBonus(actor) {
  return saltoBonus(actor) + flipBeltBonus(actor);
}

/**
 * Malearius/Малеарий (Элитный архетип: Гладиатор, домашнее правило): ×2
 * длина Отскока Уклонением — ТОЛЬКО вооружённый метеоритным молотом и не
 * нося брони прочнее AP4 ни на одной части тела. AP локации — чистая броня
 * без T.b (absorption[loc] хранит AP+T.b, см. combat/damage.mjs), проверяются
 * ВСЕ шесть локаций, не только место последнего попадания: условие Таланта
 * («не нося брони прочнее AP4 нигде») — это состояние экипировки, а не
 * конкретного удара.
 */
function malaeriusActive(actor) {
  const hasTalent = hasAbility(actor, "ability.malearius", "Malearius", "talent");
  if (!hasTalent) return false;
  // «Вооружён метеоритным молотом» спрашивается КЛЮЧОМ, а не именем надетого
  // оружия (wdbc-h1bx). Прежняя проверка itemHasName(weapon, "Meteor Hammer")
  // не срабатывала НИКОГДА: документ в паке называется «Метеоритный Молот»,
  // без английской половины, и так названы все соседи по папке — у оружия
  // здесь принято русское имя. Ключ заодно покрывает СИЛОВОЙ вариант, который
  // проверка по имени не признала бы и с исправленным названием, хотя книга
  // говорит про метеоритный молот вообще. Оружие выдаёт ключ, только пока
  // надето, поэтому отдельная проверка экипировки больше не нужна.
  if (!hasRuleFlag(actor, "weapon.meteorHammer")) return false;
  const absorption = actor?.system?.absorption ?? {};
  const tb = Number(absorption.toughnessBonus) || 0;
  return ARMOR_LOCATIONS.every(loc => (Number(absorption[loc]) || 0) - tb <= 4);
}

/**
 * Множитель дистанции Отскока от предметов (Malearius ×2, стр. — домашнее
 * правило) — применяется к SPD+плоским бонусам, НЕ к бонусу от непотраченных
 * ОД (recoilLimit п.7, module/combat/recoil-pool.mjs): та прибавка
 * фиксируется абсолютным числом метров в момент траты ОД, не пересчитывается
 * задним числом при изменении экипировки/брони — раздельные величины, по
 * тексту правила про «эту прибавку», а не про предел в целом.
 */
export function recoilItemMultiplier(actor) {
  return malaeriusActive(actor) ? 2 : 1;
}

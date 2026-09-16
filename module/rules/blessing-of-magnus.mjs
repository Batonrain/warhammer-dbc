// module/rules/blessing-of-magnus.mjs
//
// Blessing of Magnus / Благословение Магнуса (психосила, Тзинч, wdbc-1rno.5,
// находка 10/12): «Эту психосилу можно манифестировать и поддерживать только
// когда псайкер тяжело или критически ранен. Псайкер получает... может
// проводить Полу-прицеливание психосиловым оружием как свободное действие...»
//
// Из трёх клауз эффекта здесь — только Полу-прицеливание (единственная,
// касающаяся Прицеливания). «+5×PR на тесты W» и «Пси-Капюшон без капюшона»
// — честный остаток, вынесены отдельным тикетом wdbc-1rno.34.
//
// «Манифестирует/поддерживает только тяжело/критически ранен» — woundTier
// heavy/dying (тот же предикат, что predicates.mjs::woundTier), И сама сила
// сейчас реально поддерживается (item.system.isSustained — тот же флаг,
// что читает apps/effects.mjs::isItemActive для psychicPower, не
// импортируется отсюда напрямую: rules/ не тянет apps/, обратное
// направление зависимостей проекта).

import { itemIs } from "./item-marker.mjs";

const NAME = "Blessing of Magnus";
export const BLESSING_OF_MAGNUS_CAPABILITY = "psychicPower.tzeentch.blessingOfMagnus";

function isBlessingOfMagnusItem(item) {
  return itemIs(item, "psychicPower", BLESSING_OF_MAGNUS_CAPABILITY, NAME);
}

/** Сила манифестирована/поддерживается прямо сейчас, и актор тяжело/критически ранен. */
export function hasActiveBlessingOfMagnus(actor) {
  const tier = actor?.system?.wounds?.tier;
  if (tier !== "heavy" && tier !== "dying") return false;
  return !!actor?.items?.some(i => isBlessingOfMagnusItem(i) && !!i.system?.isSustained);
}

/** Носит ли актор экипированное психосиловое оружие (weaponProp key:"force"). */
export function actorHasEquippedForceWeapon(actor) {
  return !!actor?.items?.some(i =>
    i.type === "weapon" && i.system?.equipped
    && (i.system?.weaponProps || []).some(p => p.key === "force"));
}

/** Полу-Прицеливание свободным действием психосиловым оружием, пока сила активна. */
export function blessingOfMagnusFreeHalfAim(actor) {
  return hasActiveBlessingOfMagnus(actor) && actorHasEquippedForceWeapon(actor);
}

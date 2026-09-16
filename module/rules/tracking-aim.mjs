// module/rules/tracking-aim.mjs
//
// Tracking Aim / Прицел на Упреждение (Талант, wdbc-1rno.5): «Когда он
// совершает Прицеливание, персонаж может пройти тест на P+0, чтобы его
// следующий выстрел игнорировал все штрафы на стрельбу за скорость цели,
// высоту, и Таланты, дающие штрафы по совершающим Бег или Натиск целям.»
//
// Из трёх условий реально существует в движке только одно — штраф за Бег
// цели (attack-dialog.mjs::runningMod, −20 дальнобойной). «Высота цели» —
// честный архитектурный пробел, вынесен отдельным тикетом wdbc-1rno.29
// («Полёт/высота»). «Таланты, дающие штрафы по Бег/Натиск целям» —
// единственный кандидат, Hard Target/Трудная Цель (dodge.core.hardTarget),
// сам не реализован — вынесен wdbc-1rno.30. Решение пользователя 16.09.2026:
// оба пробела — отдельные тикеты, не расширять эту находку; когда они
// закроются, gates здесь нужно будет дополнить.
//
// Тест P+0 — бесплатный довесок к объявлению Прицеливания (не тратит ОД/
// Реакцию сверх самого Прицеливания), решение пользователя: вариант A —
// HUD-галочка рядом с кнопками Прицеливания, тест катается прямо в клике.
// Успех ставит flags.warhammer-dbc.trackingAimActive — тратится «следующим
// выстрелом» (attack/dialog.mjs, независимо от Aim Focus — тот продлевает
// САМ бонус Прицеливания на несколько атак, Tracking Aim расходуется первым
// же дальнобойным выстрелом в любом случае), либо впустую любым другим
// действием (combat/action-economy.mjs::_maybeClearAiming, combat/damage.mjs
// — та же точка, что чистит system.aiming).

import { hasAbility } from "./ability-by-key.mjs";

export const TRACKING_AIM_CAPABILITY = "rangedCore.core.trackingAim";
export const TRACKING_AIM_PENDING_FLAG = "trackingAimPending"; // HUD-галочка до клика
export const TRACKING_AIM_ACTIVE_FLAG = "trackingAimActive";   // тест пройден, ждёт следующего выстрела

export function hasTrackingAim(actor) {
  return hasAbility(actor, TRACKING_AIM_CAPABILITY, "Tracking Aim", "talent");
}

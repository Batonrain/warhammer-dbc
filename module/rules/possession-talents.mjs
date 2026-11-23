// module/rules/possession-talents.mjs
// Таланты одержимых, которым хватает листа хоста (корбук, «Одержимый»).
//
// Shared Slaughter / Общая Бойня: «В Проявлении считается двумя персонажами для
// численного превосходства». Счёт контакта — combat/tactical-map.mjs::
// meleeContactCount, сюда он спрашивает «вес» каждого стоящего рядом.

import { hasItemNamed } from "./req-atom.mjs";

/** Проявлен ли демон (вкладка Одержимого, system.possession.manifested). */
export const isManifested = actor => !!actor?.system?.possession?.manifested;

/** Сколькими персонажами актор идёт в численное превосходство: 2 — Общая Бойня в Проявлении. */
export function outnumberWeight(actor) {
  if (!actor) return 1;
  return isManifested(actor) && hasItemNamed(actor, "Shared Slaughter", ["talent"]) ? 2 : 1;
}

// Many-Eyed / Дар: Многоглазый — «Круговое зрение». Обзор защищающегося для
// «вне поля зрения» (combat/facing.mjs::isOutsideDefenderView) — 360° в Проявлении.
export function manyEyedSightAngle(actor, angle) {
  return isManifested(actor) && hasItemNamed(actor, "Many-Eyed", ["talent"]) ? 360 : angle;
}

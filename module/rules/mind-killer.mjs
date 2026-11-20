// module/rules/mind-killer.mjs
// ════════════════════════════════════════════════════════════════════════
//  Mind Killer / Убийца Разума (Таланты Смелости, Основная книга): «Персонаж
//  отнимает ½I (окр.▼) от бросков на Шок…». Читают оба места, где бросается
//  Шок: провал теста Страха (combat/fear.mjs::_executeFearRoll) и Шок
//  Инфернальной Воли (fear.mjs::rollInfernalWillShockDetailed).
//
//  Вторая половина Таланта («будучи Подавлен или в Панике от Горения/Удушья,
//  может пройти I−10, чтобы действовать в свой Ход нормально») остаётся
//  текстом: у Подавления и Паники нет места, где система спрашивала бы
//  «действует ли он нормально в этот Ход».
// ════════════════════════════════════════════════════════════════════════

import { hasAbility } from "./ability-by-key.mjs";

export const MIND_KILLER_CAPABILITY = "shock.mindKiller";

/** Сколько вычесть из броска Шока: ½ Интеллекта с округлением вниз, 0 — нет Таланта. */
export function mindKillerShockReduction(actor) {
  if (!hasAbility(actor, MIND_KILLER_CAPABILITY, "Mind Killer")) return 0;
  const int = Number(actor?.system?.characteristics?.int?.total) || 0;
  return Math.max(0, Math.floor(int / 2));
}

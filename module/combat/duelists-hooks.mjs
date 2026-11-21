// module/combat/duelists-hooks.mjs
// Такты боя пачки «дуэлянты» одной точкой для hooks.mjs: начало Хода, конец
// Хода, конец боя. Каждая строка — одна книжная фраза, разбор — в файлах архетипов.

import { processBladesOfFateTurnStart, clearBattlePools } from "./raven.mjs";
import { expireWarSeerAtTurnStart, clearWarSeer } from "./vitkis.mjs";
import { bloodyPerformanceTurnEnd } from "./gladiator.mjs";

/** Начало Хода бойца. */
export async function duelistsTurnStart(actor) {
  // Клинки Судьбы (Ворон): +1 бонусное Очко Бесчестия (Чтец Течения — +2).
  await processBladesOfFateTurnStart(actor);
  // Провидец Войны (Виткис): эффект живёт «до начала своего следующего Хода».
  await expireWarSeerAtTurnStart(actor);
}

/** Конец Хода бойца. */
export async function duelistsTurnEnd(actor, combat) {
  // Кровавое Представление (Гладиатор): набран ли Момент за Ход.
  await bloodyPerformanceTurnEnd(actor, combat);
}

/** Конец боя. */
export async function duelistsCombatEnd(combat) {
  // Бонусные Очки Клинков Судьбы и Отца Крови «теряются в конце боя».
  await clearBattlePools(combat);
  await clearWarSeer(combat);
}

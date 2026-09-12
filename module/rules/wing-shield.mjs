// module/rules/wing-shield.mjs
//
// Положение Крыльев импланта (wdbc-lmd2, найдено внутри wdbc-q0q8): у щита-
// дефлектора Aelindrach Wings/Крылья Элиндраха (и потенциально других
// имплантатов-Крыльев) рейтинг зависит от того, сложены крылья за спиной
// (защита только со спины — направление код не проверяет, решает стол),
// окутывают персонажа (защита со всех направлений) или расправлены/в полёте
// (щита нет вовсе). Чистый расчёт: какие поля system.shield.* поменять при
// выборе нового положения — сама запись в документ остаётся в
// module/sheets/item-sheet.mjs (Foundry-обвязка).

/**
 * @param {""|"folded"|"wrapped"|"flying"} position
 * @param {{wingRatingFolded?: number, wingRatingWrapped?: number}} ratings
 *   книжные числа ЭТОГО конкретного предмета (system.shield.wingRatingFolded/Wrapped).
 * @returns {object} патч для item.update() — всегда несёт wingPosition, плюс
 *   ratingMax/enabled (folded/wrapped) или отключение поля (flying). Пустая
 *   строка (не Крылья) — патч несёт только саму позицию, остальное не трогает.
 */
export function wingPositionShieldUpdate(position, { wingRatingFolded = 0, wingRatingWrapped = 0 } = {}) {
  const upd = { "system.shield.wingPosition": position };
  if (position === "folded") {
    upd["system.shield.ratingMax"] = wingRatingFolded || 0;
    upd["system.shield.enabled"]   = true;
  } else if (position === "wrapped") {
    upd["system.shield.ratingMax"] = wingRatingWrapped || 0;
    upd["system.shield.enabled"]   = true;
  } else if (position === "flying") {
    upd["system.shield.enabled"]       = false;
    upd["system.shield.status"]        = "inactive";
    upd["system.shield.currentRating"] = 0;
  }
  return upd;
}

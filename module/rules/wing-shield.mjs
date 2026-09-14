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
 * @param {object} shield  текущий system.shield предмета: книжные числа
 *   этого предмета (wingRatingFolded/wingRatingWrapped) и статус щита.
 * @returns {object} патч для item.update() — всегда несёт wingPosition, плюс
 *   ratingMax/enabled (folded/wrapped) или отключение поля (flying). Пустая
 *   строка (не Крылья) — патч несёт только саму позицию, остальное не трогает.
 */
export function wingPositionShieldUpdate(position, shield = {}) {
  const { wingRatingFolded = 0, wingRatingWrapped = 0, status = "" } = shield;
  const upd = { "system.shield.wingPosition": position };

  const applyRating = (rating) => {
    // Книжное число для этого положения не заполнено — НЕ затирать уже
    // выставленный ratingMax нулём: вернуть прежнее значение будет неоткуда,
    // а именно так и выходило при штатном порядке действий (ГМ сначала
    // выбирает положение, и только потом видит поля рейтингов). Ноль как
    // осмысленное значение здесь не нужен: «щита нет» — это положение
    // «Расправлены», у него своя ветка ниже.
    if (!rating) return;
    upd["system.shield.ratingMax"] = rating;
    upd["system.shield.enabled"]   = true;
    // Бросок щита катается против currentRating (combat/shield.mjs::
    // _rollShieldActivation), а тот заполняется из ratingMax только в момент
    // ВКЛЮЧЕНИЯ щита. Без этой строки смена положения уже включённого щита
    // меняла число на листе, а кубик продолжал катиться против старого.
    if (status === "active") upd["system.shield.currentRating"] = rating;
  };

  if (position === "folded")       applyRating(Number(wingRatingFolded) || 0);
  else if (position === "wrapped") applyRating(Number(wingRatingWrapped) || 0);
  else if (position === "flying") {
    upd["system.shield.enabled"]       = false;
    upd["system.shield.status"]        = "inactive";
    upd["system.shield.currentRating"] = 0;
  }
  return upd;
}

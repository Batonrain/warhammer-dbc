// module/rules/limb-loss.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Потеря Конечностей (стр. 30-31, «Потеря конечностей всегда приводит к
//  Кровотечению. Обрубок конечности нуждается в медицинской обработке
//  (Medicae−10, 5 минут), иначе через T.b дней с шансом 80% (1-8 на 1d10)
//  он загноится и вызовет Гангрену») — wdbc-1rno.6.
//
//  Чистая логика планирования отложенной проверки Гангрены обрубка: НЕ
//  тот же приём, что «сразу второй бросок» у Ампутации (sheets/tabs/
//  healing.mjs::applyAmputate, отдельная книжная строка стр. 231 про
//  добровольную операцию) — здесь ровно то, что просит книга буквально:
//  таймер на T.b ДНЕЙ, снимаемый явной обработкой обрубка ДО срабатывания.
//  По прямому указанию пользователя эта отложенная проверка — намеренно
//  общий примитив (не «только для крит-эффектов»): любой будущий источник
//  потери конечности сможет запланировать её тем же вызовом.
//
//  Мутация Loss of Limb/Потеря Конечности (wdbc-1rno.6.1, отдельный тикет)
//  ЭТОТ таймер заводить не должна — её книжный текст прямо говорит, что
//  утраченная часть тела «исчезает, оставляя обрубок плоти, словно давно
//  затянувшаяся рана»: обрубок уже закрыт, Кровотечения и риска Гангрены
//  нет. Вызывающий код сам решает, звать ли scheduleLimbLossGangrene —
//  этот модуль не связывает её с самим наложением lostX-Состояния.
// ════════════════════════════════════════════════════════════════════════════

import { SECONDS_PER_DAY } from "../constants/imperial-calendar.mjs";

/** Ключи Состояний потери частей тела (constants/conditions.mjs) — общий список,
 *  чтобы crit-effect-parser/healing.mjs не держали копию каждый у себя. */
export const LIMB_LOSS_KEYS = ["lostHands", "lostArms", "lostFeet", "lostLegs", "lostEyes"];

const GANGRENE_AT_FIELD = Object.fromEntries(LIMB_LOSS_KEYS.map(k => [k, `${k}GangreneAt`]));

/** Имя поля-таймера (напр. "lostHandsGangreneAt") или null для чужого ключа. */
export function limbLossGangreneField(key) {
  return GANGRENE_AT_FIELD[key] || null;
}

/** Момент (game.time.worldTime), когда сработает проверка Гангрены — T.b дней от сейчас. */
export function limbLossGangreneCheckAt(worldTime, tb) {
  return Number(worldTime) + (Number(tb) || 0) * SECONDS_PER_DAY;
}

/**
 * Какие из уже запланированных таймеров актора СЕЙЧАС просрочены — чистая
 * функция, читает только переданный снимок Состояний, ничего не решает сама
 * про бросок/применение Гангрены (это делает вызывающий Foundry-слой).
 * @param {object} conditions actor.system.conditions
 * @param {number} worldTime  game.time.worldTime
 * @returns {string[]} ключи Состояний (lostHands/…) с просроченным таймером
 */
export function dueLimbLossGangreneKeys(conditions, worldTime) {
  return LIMB_LOSS_KEYS.filter(key => {
    const at = Number(conditions?.[GANGRENE_AT_FIELD[key]]) || 0;
    return at > 0 && Number(worldTime) >= at;
  });
}

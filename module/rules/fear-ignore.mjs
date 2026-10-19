// module/rules/fear-ignore.mjs
// ════════════════════════════════════════════════════════════════════════
//  «Игнорировать Страх» — одно место для всех путей, которыми книга
//  позволяет обойтись без теста Страха, и для отмены их всех разом.
//
//  Пути (корбук):
//   • память сцены, стр. 53: «после того, как они прошли или провалили этот
//     тест, они до конца сцены игнорируют все прочие источники Страха равного
//     или ниже рейтинга» — теста нет вовсе;
//   • автоуспех Важного персонажа, стр. 53: Infamy не ниже порога рейтинга
//     или свой рейтинг Страха «равный или выше, чем у источника»;
//   • Стальное Сердце (Мутация, wdbc-tsz6): «считает все рейтинги Страха на 1
//     меньше… игнорируя их, если рейтинг Страха опускается до 0».
//
//  «Не может игнорировать этот Страх» (Затронутый Варпом, субмутация 1,
//  wdbc-1rno.26) снимает все три — решение владельца 02.10.2026: книга
//  называет «игнорированием» каждый из них, а какой именно имеется в виду —
//  не уточняет. Стальное Сердце снимается целиком, со снижением на 1: иначе
//  против Страха 3 оно не снималось бы никогда (3 − 1 до 0 не доходит).
//
//  Иммунитет (fear.immune, Саркофаг Дредноута) — не «игнорирование», а
//  отсутствие страха вообще; он остаётся в combat/fear.mjs и этим не
//  снимается. Infamy, вычитаемое из броска Шока, — тоже не игнорирование.
//
//  Чистый модуль без Foundry — test/rules/fear-ignore.test.mjs.
// ════════════════════════════════════════════════════════════════════════

import { FEAR_RATINGS } from "../constants/fear-tables.mjs";

/** Подписи путей для карточки: что отменено «нельзя игнорировать». */
export const FEAR_IGNORE_LABELS = {
  scene: "память сцены",
  infamy: "автоуспех по Infamy",
  ownFear: "автоуспех по своему Страху",
  steelHeart: "Стальное Сердце"
};

/**
 * Как персонаж обходится с источником Страха.
 *
 * @param {object} p
 * @param {number|string} p.rating настоящий рейтинг Страха источника
 * @param {boolean} [p.important]  Важный персонаж (автоуспех — только у них)
 * @param {number}  [p.infamy]     характеристика Infamy
 * @param {number}  [p.ownFear]    собственный рейтинг Страха персонажа
 * @param {number}  [p.faced]      наибольший Страх, против которого уже был тест в этой сцене
 * @param {boolean} [p.steelHeart] есть Стальное Сердце
 * @param {boolean} [p.free]       бесплатный переброс Демона — тот же тест, не новая встреча
 * @param {boolean} [p.unignorable] этот Страх нельзя игнорировать
 * @returns {{rating:number, skip:boolean, autoPass:boolean, cancelled:string[]}}
 *   rating — рейтинг, по которому считается порог (Стальное Сердце его
 *   снижает; 0 и ниже — вне таблицы); skip — теста нет (память сцены);
 *   autoPass — тест засчитан успешным; cancelled — ключи FEAR_IGNORE_LABELS
 *   путей, которые сработали бы, но отменены «нельзя игнорировать».
 */
export function fearIgnore({ rating, important = false, infamy = 0, ownFear = 0, faced = 0,
                             steelHeart = false, free = false, unignorable = false } = {}) {
  const real = Number(rating) || 0;
  const lowered = steelHeart ? real - 1 : real;
  const r = FEAR_RATINGS[lowered] || FEAR_RATINGS[1];
  const own = Number(ownFear) || 0;
  const ways = {
    scene: !free && (Number(faced) || 0) >= real,
    infamy: !!important && (Number(infamy) || 0) >= r.infamy,
    ownFear: !!important && own > 0 && own >= real,
    steelHeart: !!steelHeart
  };
  if (!unignorable) {
    return { rating: lowered, skip: ways.scene, cancelled: [],
             autoPass: (ways.steelHeart && lowered <= 0) || ways.infamy || ways.ownFear };
  }
  return { rating: real, skip: false, autoPass: false,
           cancelled: Object.keys(ways).filter(k => ways[k]) };
}

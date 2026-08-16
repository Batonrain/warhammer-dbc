// module/constants/start-levels.mjs
//
// Уровень стартовой игры (стр. 23). ГМ выбирает, насколько опытными входят в
// игру персонажи: строка таблицы даёт стартовый опыт и бонусы к Бесчестию и
// Порче. Опыт у Десантника и у прочих разный — Десантник дороже качается,
// поэтому получает меньше на том же уровне.
//
// «Inf и Cor стартового персонажа не могут превышать 60» — это потолок из
// книги, и он же ограничивает сумму с ручной добавкой.

/** Потолок стартовых Бесчестия и Порчи. */
export const START_CAP = 60;

/** Строки таблицы: [опыт Десантника, опыт прочих, бонус Inf, бонус Cor]. */
export const START_LEVELS = [
  { key: "l1", astartes:  3000, mortal:  3750, infamy:  0, corruption:  0 },
  { key: "l2", astartes:  6000, mortal:  7500, infamy: 10, corruption: 12 },
  { key: "l3", astartes:  9000, mortal: 11250, infamy: 20, corruption: 24 },
  { key: "l4", astartes: 12000, mortal: 15000, infamy: 30, corruption: 36 },
  { key: "l5", astartes: 15000, mortal: 18750, infamy: 40, corruption: 48 },
  { key: "l6", astartes: 20000, mortal: 25000, infamy: 50, corruption: 60 },
  { key: "l7", astartes: 25000, mortal: 31250, infamy: 60, corruption: 60 },
  { key: "l8", astartes: 30000, mortal: 37500, infamy: 60, corruption: 60 }
];

const clampCap = v => Math.max(0, Math.min(START_CAP, Math.round(Number(v) || 0)));

/**
 * Что получит персонаж на выбранном уровне.
 *
 * @param {object} o
 * @param {string}  o.level     ключ строки таблицы
 * @param {boolean} o.astartes  колонка опыта: Десантник или прочие
 * @param {number}  o.extraXp   ручная добавка опыта
 * @param {number}  o.extraInf  ручная добавка Бесчестия
 * @param {number}  o.extraCor  ручная добавка Порчи
 * @returns {{xp:number, infamy:number, corruption:number, capped:boolean}|null}
 */
export function startLevelValues({ level, astartes = false,
                                   extraXp = 0, extraInf = 0, extraCor = 0 } = {}) {
  const row = START_LEVELS.find(l => l.key === level);
  if (!row) return null;

  const infamyRaw = row.infamy     + (Number(extraInf) || 0);
  const corRaw    = row.corruption + (Number(extraCor) || 0);
  return {
    xp:          Math.max(0, (astartes ? row.astartes : row.mortal) + (Number(extraXp) || 0)),
    infamy:      clampCap(infamyRaw),
    corruption:  clampCap(corRaw),
    // Потолок сработал — это стоит сказать вслух, иначе введённое число молча
    // пропадает.
    capped:      infamyRaw > START_CAP || corRaw > START_CAP
  };
}

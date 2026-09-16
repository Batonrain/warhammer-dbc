// module/rules/overwatch.mjs
//
// Караул / Overwatch (core.json, «II. МЕХАНИКА», раздел действий, рядом с
// «Перезарядка»/«Расклин», wdbc-1rno.27): «Действие: Полное действие. Тип:
// Атака, Физическое, Стрельба, Ментальное. Персонаж выбирает сектор
// стрельбы в 45° (или меньше по собственному выбору), и условие для
// открытия огня. В любой момент до начала следующего Хода, когда противник
// в секторе стрельбы выполняет это условие, стрелок может сделать по нему
// Одиночный Выстрел, Короткую Очередь или Длинную Очередь. При Карауле
// одиночными персонаж может сделать до ½BS.b(окр.▼) выстрелов за один
// Караул (по разным целям), но не более наибольшего RoF оружия. Цели
// Караула должны сразу после выстрела пройти тест на Подавление+20.»
//
// ЯДРО — чистая логика бюджета выстрелов и геометрии сектора (сама геометрия
// уже есть в rules/facing.mjs, здесь только то, что специфично Караулу).
// Foundry-обвязка (состояние на акторе, хук на движение вражеского токена,
// чат-карточки) — module/combat/overwatch.mjs.
//
// КЛЮЧЕВОЙ НЮАНС бюджета: «до ½BS.b выстрелов» — только если КАЖДЫЙ выстрел
// этого Караула — Одиночный. Выбрал хоть раз Короткую/Длинную Очередь —
// книга не даёт для них множественного повтора: этот выстрел расходует
// Караул целиком, независимо от того, сколько «одиночных» оставалось.

/** Максимальная ширина сектора по умолчанию — 45°. Scanning Advance расширяет до 90°. */
export const OVERWATCH_DEFAULT_MAX_ARC = 45;

/** Scanning Advance/Сканирующее Продвижение (wdbc-1rno.37) — расширенный сектор. */
export const OVERWATCH_SCANNING_ADVANCE_MAX_ARC = 90;

/**
 * Бюджет Одиночных Выстрелов на один Караул: ½BS.b, округлённое ВНИЗ, но не
 * больше наибольшего RoF оружия (rof_full||rof_semi||rof_single, тот же
 * порядок значимости, что supCap в module/combat/attack.mjs). Минимум 1 —
 * иначе Караул одиночными был бы бессмысленен при низком BS.b.
 * @param {object} chars      actor.system.characteristics
 * @param {object} weaponSys  item.system оружия, на которое объявлен Караул
 */
export function overwatchSingleShotBudget(chars, weaponSys) {
  const bsBonus = Number(chars?.bs?.bonus) || 0;
  const halved  = Math.floor(bsBonus / 2);
  const maxRof  = Math.max(
    Number(weaponSys?.rof_full)   || 0,
    Number(weaponSys?.rof_semi)   || 0,
    Number(weaponSys?.rof_single) || 0,
    1
  );
  return Math.max(1, Math.min(halved || 1, maxRof));
}

/**
 * Что происходит с состоянием Караула после одного выстрела заданным
 * режимом очереди. Одиночный — списывает 1 из бюджета, Караул остаётся
 * активным, пока бюджет не исчерпан. Короткая/Длинная — расходует Караул
 * целиком одним выстрелом, независимо от оставшегося бюджета.
 * @param {"single"|"semi"|"full"} rofMode
 * @param {number} shotsRemaining  текущий остаток бюджета Одиночных
 * @returns {{shotsRemaining: number, exhausted: boolean}}
 */
export function applyOverwatchShot(rofMode, shotsRemaining) {
  if (rofMode === "single") {
    const left = Math.max(0, (Number(shotsRemaining) || 0) - 1);
    return { shotsRemaining: left, exhausted: left <= 0 };
  }
  return { shotsRemaining: 0, exhausted: true };
}

/**
 * Ширина сектора, доступная актору при объявлении Караула: 90° со Scanning
 * Advance (capabilities.mjs rangedCore.core.scanningAdvance), иначе 45°.
 * Игрок может объявить и меньше — параметр только про потолок.
 */
export function overwatchMaxArc(hasScanningAdvance) {
  return hasScanningAdvance ? OVERWATCH_SCANNING_ADVANCE_MAX_ARC : OVERWATCH_DEFAULT_MAX_ARC;
}

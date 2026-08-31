// module/rules/facing.mjs
// ════════════════════════════════════════════════════════════════════════════
//  FACING / УГОЛ ОБЗОРА (wdbc-p5el) — чистая геометрия, без Foundry.
//
//  Книга формализует направление в нескольких местах (core.json): «Обычный
//  персонаж имеет угол обзора в 210°», Cloak «не защищает от атак с передней
//  арки 90°», сектор обстрела в Карауле (90°/180°/±15° в зависимости от
//  снаряжения), угол обзора пилота Дредноута (65°-210°), сектора обстрела
//  корабельных орудий (нос/борт/корма, void.json). Первая реализация —
//  Cloak (сама механика уже готова, wdbc-sg57); тот же примитив годится и
//  для Blinders, и для арок техники/корабля позже (wdbc-m38e/wdbc-jr93).
//
//  Соглашение по углам — как у Foundry TokenDocument.rotation: 0° — «на
//  север» (вверх по экрану, отрицательный Y в канвасных координатах),
//  положительные градусы — по часовой стрелке. Канвасные координаты сами по
//  себе с Y вниз, поэтому пеленг считается atan2(dx, -dy), а не привычным
//  atan2(dy, dx) — иначе направления вышли бы зеркальными.
//
//  Foundry-обвязка (чтение x/y/rotation живого токена, canvas) —
//  combat/facing.mjs.
// ════════════════════════════════════════════════════════════════════════════

/** Нормализует угол в градусах к диапазону [0, 360). */
export function normalizeAngle360(deg) {
  const a = deg % 360;
  return a < 0 ? a + 360 : a;
}

/** Нормализует угол в градусах к диапазону (-180, 180] — удобно для «насколько левее/правее». */
export function normalizeAngle180(deg) {
  const a = normalizeAngle360(deg);
  return a > 180 ? a - 360 : a;
}

/**
 * Евклидово расстояние между двумя точками сцены, в тех же единицах, что и
 * координаты (пиксели). Перевод в игровые метры — на стороне Foundry-обвязки
 * (combat/facing.mjs::tokenDistance), т.к. масштаб (grid.size/grid.distance)
 * читается из canvas, а не передаётся сюда.
 * @param {{x:number,y:number}} a
 * @param {{x:number,y:number}} b
 */
export function pixelDistance(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/**
 * Пеленг из точки A в точку B, в градусах: 0° — на север, по часовой.
 * @param {{x:number,y:number}} from
 * @param {{x:number,y:number}} to
 * @returns {number} [0, 360)
 */
export function bearingDegrees(from, to) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (dx === 0 && dy === 0) return 0; // токены в одной точке — направление не определено, «прямо по курсу»
  return normalizeAngle360(Math.atan2(dx, -dy) * (180 / Math.PI));
}

/**
 * Ближайшая точка из `candidates`, лежащая ПОЗАДИ `throughPos` на луче
 * origin→throughPos (Выстрел Насквозь, wdbc-wlwf/wdbc-t9ei): «следующая
 * цель по линии огня» — не любая ближайшая цель на сцене, а именно та, что
 * находится дальше от стрелка, чем пробитая цель, и примерно на той же
 * прямой (боковой допуск `corridorPx` — снаряд не идеальная линия толщиной
 * в атом). Каждый элемент `candidates` — произвольный объект с {x,y}, лишние
 * поля не трогаются и возвращаются как есть (вызывающая сторона сама
 * прикладывает к позиции ссылку на токен).
 * @param {{x:number,y:number}} originPos     Позиция стрелка.
 * @param {{x:number,y:number}} throughPos    Позиция уже пробитой цели.
 * @param {Array<{x:number,y:number}>} candidates
 * @param {number} corridorPx  Допустимое боковое отклонение от луча, пиксели.
 * @returns {object|null}  Элемент candidates с минимальной проекцией «дальше цели», либо null.
 */
export function nearestPointBehindOnRay(originPos, throughPos, candidates, corridorPx) {
  const dx = throughPos.x - originPos.x;
  const dy = throughPos.y - originPos.y;
  const rayLen = Math.hypot(dx, dy);
  if (!rayLen) return null; // стрелок и цель в одной точке — направления нет
  const ux = dx / rayLen, uy = dy / rayLen;
  const throughProj = dx * ux + dy * uy; // = rayLen, проекция самой цели

  let best = null, bestProj = Infinity;
  for (const c of candidates) {
    const vx = c.x - originPos.x, vy = c.y - originPos.y;
    const proj = vx * ux + vy * uy;
    if (proj <= throughProj) continue; // не дальше пробитой цели — не «позади»
    const lateral = Math.abs(vx * uy - vy * ux); // перпендикуляр к лучу
    if (lateral > corridorPx) continue;
    if (proj < bestProj) { bestProj = proj; best = c; }
  }
  return best;
}

/**
 * Насколько пеленг отклоняется от текущего разворота наблюдателя: 0 — прямо
 * по курсу, ±90 — строго сбоку, ±180/-180 — строго сзади. Знак — по часовой
 * (положительный = правее курса), но большинству вызывающих нужен только
 * модуль (ширина дуги симметрична).
 * @param {number} observerRotation  токена-наблюдателя, градусы (0-360)
 * @param {number} bearing           пеленг до другой точки, градусы (0-360)
 * @returns {number} (-180, 180]
 */
export function relativeBearing(observerRotation, bearing) {
  return normalizeAngle180(bearing - observerRotation);
}

/**
 * Попадает ли пеленг в симметричную дугу заданной ширины, отсчитанную от
 * разворота наблюдателя. Ширина 90 — «передняя арка 90°» Плаща (по 45° на
 * сторону от курса); ширина 210 — базовый угол обзора персонажа (стр. …).
 * @param {number} observerRotation
 * @param {number} bearing
 * @param {number} arcWidthDegrees  полная ширина дуги (не половина)
 */
export function isWithinArc(observerRotation, bearing, arcWidthDegrees) {
  return Math.abs(relativeBearing(observerRotation, bearing)) <= arcWidthDegrees / 2;
}

/**
 * Была ли атака на observer нанесена из его передней дуги — то, что нужно
 * Cloak/Плащу («не защищает от атак с передней арки 90°»). Считает пеленг
 * ОТ защищающегося К атакующему и сравнивает с разворотом защищающегося.
 * @param {{x:number,y:number}} defenderPos
 * @param {number}               defenderRotation
 * @param {{x:number,y:number}} attackerPos
 * @param {number}               [arcWidthDegrees] по умолчанию 90 — как у Cloak
 */
export function isFrontArcHit(defenderPos, defenderRotation, attackerPos, arcWidthDegrees = 90) {
  return isWithinArc(defenderRotation, bearingDegrees(defenderPos, attackerPos), arcWidthDegrees);
}

/**
 * Разбирает строку сектора наводки орудия техники (vehicleMount.hArc/vArc,
 * wdbc-m38e) в ширину дуги и её смещение от продольной оси машины —
 * конвенция книги («Установка», ГН/ВН, machines.json): 0° — вперёд, +90° —
 * вправо, −90° — влево, 360° — круговой траверс. Форматы:
 *   "360°"        — не ограничено (ширина ≥360 всегда проходит isWithinArc,
 *                    но отдаём null явно — вызывающему проще пропустить проверку)
 *   "a°..b°"      — диапазон, читается КАК ЕСТЬ (не через кратчайшую дугу от
 *                    a к b по модулю 360, а как обычный числовой интервал):
 *                    центр (a+b)/2, ширина |b−a|. Так «−135°..−45°» (Скорпиус,
 *                    спонсон) даёт центр −90°/ширину 90° без обёртывания, а
 *                    «−5°..−175°» (Карахнос) — центр −90°/ширину 170° тоже без
 *                    обёртывания через 0/180, просто потому что оба числа уже
 *                    записаны с нужным знаком для этой стороны.
 *   одиночное число — полная ширина дуги по центру оси (как ширина у isWithinArc).
 * Нераспознанное или отсутствующее значение (в т.ч. "—", "", описательные
 * пометки на рукопашном оружии вроде "рука"/"ноги"/"корпус" — см.
 * MOUNT_NOTES/vehicle.mjs, у мукопашных «дуга» не при чём) — считается
 * неограниченным: тот же принцип «нет данных — не наказываем», что и в
 * isFrontArcHit/resolveAttackerToken.
 * @param {string} spec
 * @returns {{width:number, center:number}|null} null — сектор не ограничен
 */
export function parseMountArc(spec) {
  const s = String(spec ?? "").trim();
  if (!s) return null;
  const nums = s.match(/[+−-]?\d+(?:[.,]\d+)?/g);
  if (!nums || !nums.length) return null;
  const toNum = t => Number(t.replace(/−/g, "-").replace(",", "."));
  if (nums.length === 1) {
    const width = Math.abs(toNum(nums[0]));
    return width >= 360 ? null : { width, center: 0 };
  }
  const a = toNum(nums[0]), b = toNum(nums[1]);
  const width = Math.abs(b - a);
  return width >= 360 ? null : { width, center: (a + b) / 2 };
}

/**
 * В секторе ли горизонтальной/вертикальной наводки орудия техники цель, с
 * учётом разворота машины (wdbc-m38e — та же геометрия, что у Cloak,
 * подключённая к vehicleMount.hArc/vArc вместо брони).
 * @param {number} vehicleRotation  разворот техники (0-360, «на север»=0)
 * @param {number} bearing          пеленг от техники к цели (bearingDegrees)
 * @param {string} arcSpec          vehicleMount.hArc (или vArc, если наводка уже спроецирована в плоскость)
 */
export function isWithinMountArc(vehicleRotation, bearing, arcSpec) {
  const arc = parseMountArc(arcSpec);
  if (!arc) return true;
  return isWithinArc(vehicleRotation + arc.center, bearing, arc.width);
}

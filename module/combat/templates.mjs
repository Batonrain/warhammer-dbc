// module/combat/templates.mjs
// ═══════════════════════════════════════════════════════════════════════════
//  Разовый Шаблон зоны поражения — Взрывное (круг) и Распыление (конус 30°).
//  Тикет wdbc-1pa/wdbc-wlwf.
//
//  Foundry v14: MeasuredTemplate deprecated (client/canvas/placeables/
//  template.mjs — "since 14, until 16"), его функциональность объединена в
//  Region. Поэтому здесь используется штатный canvas.regions.placeRegion() —
//  интерактивное размещение мышью (перетаскивание/поворот — весь UX даёт
//  core Foundry, свой слой писать не пришлось). Регион создаётся эфемерным
//  (create:false) — в сцену не пишется вообще, нужен только для testPoint(),
//  и сам исчезает вместе с превью; чистить за собой не нужно.
//
//  Кто накрыт — токены, чей ЦЕНТР (testPoint) попал в фигуру. Найденные
//  токены становятся целями пользователя (canvas.tokens.setTargets), после
//  чего дальше работает уже готовый showApplyDamageDialog() (module/combat/
//  damage.mjs) — «один бросок урона на всех попавших», он и раньше умел
//  применять один и тот же damageData к game.user.targets («Всем»), просто
//  раньше цели туда ГМ отмечал вручную (см. doombc-blast-scatter).
// ═══════════════════════════════════════════════════════════════════════════

/** Пикселей на 1 метр текущей сцены — тот же приём у Шаблонов/Остаётся/Тактической карты. */
export function pxPerMeter() {
  return canvas?.dimensions?.distancePixels || canvas?.grid?.size || canvas?.scene?.grid?.size || 100;
}

/**
 * Круг радиусом `meters` — Взрывное (blastRating).
 * @param {number} meters
 * @param {number} pxPerMeter  Пикселей на 1 метр сцены (canvas.dimensions.distancePixels).
 */
export function blastCircleShape(meters, pxPerMeter) {
  return { type: "circle", x: 0, y: 0, radius: meters * pxPerMeter };
}

/**
 * Конус углом `angleDeg` (30° — Распыление по книге), длиной `meters`
 * (равна Rng режима оружия со свойством Spray).
 * @param {number} meters
 * @param {number} pxPerMeter
 * @param {number} [angleDeg]
 */
export function sprayConeShape(meters, pxPerMeter, angleDeg = 30) {
  return { type: "cone", x: 0, y: 0, radius: meters * pxPerMeter, angle: angleDeg, rotation: 0 };
}

/**
 * Разместить разовую зону поражения мышью (core-плейсмент Region-документа,
 * не сохраняется в сцену) и вернуть токены, чьи центры внутри неё.
 * @param {object} shape         Данные фигуры (blastCircleShape/sprayConeShape).
 * @param {string} [name]
 * @returns {Promise<{tokens: Token[], region: RegionDocument}|null>}  null — размещение отменено (ПКМ).
 */
export async function placeAttackTemplate(shape, name = "Зона поражения") {
  if (!canvas.ready) throw new Error("Нет активной сцены");
  const region = await canvas.regions.placeRegion({
    name,
    shapes: [shape],
    color: game.user.color.toString(),
    highlightMode: "coverage",
    displayMeasurements: true
  }, { create: false });
  if (!region) return null;
  // region отдаём наружу тоже — эфемерный (create:false), в canvas.scene.regions
  // не попадает, поэтому это единственный способ передать его дальше (например,
  // как options.templateData для Automated Animations, см. module/hooks.mjs).
  return { tokens: tokensInRegion(region), region };
}

/**
 * Токены сцены, чей центр внутри фигуры Region (testPoint) — переиспользуется
 * и разовым Шаблоном, и дрейфом зоны «Остаётся» (module/regions/linger-zone.mjs).
 * @param {RegionDocument} region
 * @returns {Token[]}
 */
export function tokensInRegion(region) {
  return canvas.tokens.placeables.filter(t => {
    if (!t.actor) return false;
    const c = t.center;
    return region.testPoint({ x: c.x, y: c.y, elevation: t.document.elevation ?? 0 });
  });
}

/** Заменить цели пользователя на накрытые шаблоном токены. */
export function targetTokens(tokens) {
  canvas.tokens.setTargets(tokens.map(t => t.id));
}

// module/regions/aura-rings.mjs
// ════════════════════════════════════════════════════════════════════════
//  Визуальный круг радиуса Ауры на канвасе (wdbc-7t0z, хвост wdbc-995w).
//
//  В отличие от превью-колец дальности/движения (wdbc-fb2d,
//  combat/range-rings.mjs — один эфемерный набор, чистится по завершении
//  прицеливания/по таймауту), здесь круги ПЕРСИСТЕНТНЫ и их может быть
//  несколько одновременно (несколько источников ауры на сцене разом,
//  например пара демонов с Daemonic Presence). Полная переотрисовка
//  (clear+redraw) при каждом вызове — дёшево, кругов немного, зато не нужно
//  диффить старое/новое состояние по каждому источнику отдельно.
//
//  Регистрируется в warhammer-dbc.mjs через тот же registerSceneLiveRecalc,
//  что и checkAuras (module/regions/auras.mjs) — те же триггеры движения
//  токена и правки предметов-источников. БЕЗ isGM-гейта: это чисто
//  визуальный оверлей поверх уже синхронных документов, каждый клиент
//  считает его одинаково локально и ничего не пишет в БД.
// ════════════════════════════════════════════════════════════════════════

import { pxPerMeter } from "../combat/templates.mjs";
import { auraDescriptorsOf } from "./auras.mjs";

/** @type {Map<string, PIXI.Graphics[]>} tokenId -> круги, нарисованные для его аур */
let _graphics = new Map();

/** Убрать все нарисованные круги аур. */
export function clearAuraRings() {
  for (const arr of _graphics.values()) {
    for (const g of arr) if (g && !g.destroyed) g.destroy();
  }
  _graphics.clear();
}

/**
 * Цвет круга по типу ауры — чистая функция, тестируется без canvas-стаба.
 * @param {"enemies"|"allies"|"all"} affects
 */
export function auraRingColor(affects) {
  if (affects === "enemies") return 0xaa2255; // угрожающая/демоническая
  if (affects === "all") return 0xe0c34c;     // нейтральная
  return 0x4ec9ff;                            // дружелюбный бафф
}

/**
 * Полная переотрисовка кругов аур для текущей отображаемой сцены.
 * @param {Scene} scene
 */
export function redrawAuraRings(scene) {
  if (!canvas?.ready || !scene || scene.id !== canvas.scene?.id) return;
  clearAuraRings();

  const ppm = pxPerMeter();
  for (const tokenDoc of scene.tokens.contents) {
    if (tokenDoc.hidden || !tokenDoc.actor) continue;
    const descriptors = auraDescriptorsOf(tokenDoc.actor);
    if (!descriptors.length) continue;
    const placeable = tokenDoc.object;
    if (!placeable?.center) continue;

    const arr = [];
    for (const d of descriptors) {
      const color = auraRingColor(d.affects);
      const gfx = new PIXI.Graphics();
      gfx.lineStyle(2, color, 0.6);
      gfx.beginFill(color, 0.08);
      gfx.drawCircle(placeable.center.x, placeable.center.y, d.radius * ppm);
      gfx.endFill();
      gfx.eventMode = "none"; // не перехватывает клики/наведение
      canvas.interface.addChild(gfx);
      arr.push(gfx);
    }
    _graphics.set(tokenDoc.id, arr);
  }
}

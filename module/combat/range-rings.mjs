// module/combat/range-rings.mjs
// ════════════════════════════════════════════════════════════════════════
//  Превью-кольца дальности на канвасе (wdbc-fb2d, ступень 1 — «дойду ли я и
//  попаду ли я» без прикладывания линейки).
//
//  Не Region (в отличие от templates.mjs/auras.mjs) — это не игровая зона с
//  testPoint()/эффектами, а чисто информационный оверлей поверх канваса:
//  concentric-круги, нарисованные raw PIXI.Graphics прямо в canvas.interface
//  («слой поверх остальных групп канваса», см. Foundry client
//  canvas/groups/interface.mjs). Один активный набор колец за раз — новый
//  вызов сам чистит предыдущий, как и полагается превью, а не персистентной
//  разметке.
//
//  Само кольцо стирается: по завершении прицеливания (endTargeting, см.
//  combat/aim.mjs), когда токен-источник реально сдвинулся (updateToken
//  x/y/elevation) или пропал со сцены, при смене сцены — и по таймауту
//  (страховка на случай, если ни один из хуков не сработал, чтобы кольцо не
//  висело вечно после ошибки).
// ════════════════════════════════════════════════════════════════════════

import { pxPerMeter } from "./templates.mjs";
import { rangeBandBoundaries } from "../rules/tactical-map.mjs";

const SAFETY_TIMEOUT_MS = 20_000;

let _active = null;   // { gfx, tokenId, offHooks: Function[], timeoutId }

/** Убрать активные кольца, если есть. */
export function clearRangeRings() {
  if (!_active) return;
  for (const off of _active.offHooks) off();
  if (_active.timeoutId) clearTimeout(_active.timeoutId);
  if (!_active.gfx.destroyed) _active.gfx.destroy();
  _active = null;
}

/**
 * Нарисовать набор концентрических колец вокруг токена.
 * @param {Token} token
 * @param {{r:number, color:number, alpha?:number}[]} rings  радиусы в метрах
 * @param {{timeout?: number}} [opts]
 */
function _draw(token, rings, { timeout = null } = {}) {
  clearRangeRings();
  if (!token?.center || !canvas?.ready) return;

  const ppm = pxPerMeter();
  const gfx = new PIXI.Graphics();
  const c = token.center;
  for (const { r, color, alpha = 0.65 } of rings) {
    if (!(r > 0)) continue;
    gfx.lineStyle(2, color, alpha);
    gfx.drawCircle(c.x, c.y, r * ppm);
  }
  gfx.eventMode = "none";   // не перехватывает клики/наведение
  canvas.interface.addChild(gfx);

  const tokenId = token.document.id;
  const onUpdateToken = (doc, changes) => {
    if (doc.id !== tokenId) return;
    if ("x" in changes || "y" in changes || "elevation" in changes) clearRangeRings();
  };
  const onDeleteToken = (doc) => { if (doc.id === tokenId) clearRangeRings(); };
  const onCanvasReady = () => clearRangeRings();

  Hooks.on("updateToken", onUpdateToken);
  Hooks.on("deleteToken", onDeleteToken);
  Hooks.on("canvasReady", onCanvasReady);

  const timeoutId = timeout ? setTimeout(clearRangeRings, timeout) : null;

  _active = {
    gfx, tokenId, timeoutId,
    offHooks: [
      () => Hooks.off("updateToken", onUpdateToken),
      () => Hooks.off("deleteToken", onDeleteToken),
      () => Hooks.off("canvasReady", onCanvasReady)
    ]
  };
}

/**
 * Кольца полос дальности оружия вокруг стрелка — рисуются при начале
 * прицеливания (module/combat/aim.mjs::beginTargeting), чтобы было видно,
 * в какую полосу дальности попадёт цель, ещё до клика по ней.
 * @param {Token} token   токен стрелка
 * @param {number} rng    эффективный Rng оружия, м
 */
export function showWeaponRangeRings(token, rng) {
  if (!(Number(rng) > 0)) return;
  const b = rangeBandBoundaries(Number(rng));
  _draw(token, [
    { r: b.pointBlank, color: 0xff5555 },
    { r: b.short,      color: 0xffaa33 },
    { r: b.combat,     color: 0x7bd858 },
    { r: b.long,       color: 0xffaa33 },
    { r: b.extreme,    color: 0xff5555 }
  ]);
}

/**
 * Одно кольцо досягаемости рукопашной атаки вокруг бойца — «кто рядом».
 * У ближнего боя нет полос В упор/Короткая/Длинная/Предельная дальнобойного
 * оружия (движок атаки их для isMelee и не считает, см. attack-dialog.mjs
 * bandKey), поэтому showWeaponRangeRings тут не годится — она рисовала одно
 * и то же превью banded-дальности и стрелку, и рукопашнику, из-за чего
 * рукопашное оружие с любым ненулевым (в т.ч. случайным/унаследованным от
 * копирования) system.range получало огромные концентрические круги вместо
 * «дотянусь ли я до соседа». Радиус — клетка сетки сцены ×1.5 (накрывает и
 * диагональных соседей, не только ортогональных), без привязки к
 * system.range оружия: тот же принцип «без прикладывания линейки», что и у
 * остального модуля.
 * @param {Token} token
 */
export function showMeleeReachRing(token) {
  const gridUnit = canvas?.scene?.grid?.distance ?? canvas?.grid?.distance ?? 1;
  _draw(token, [{ r: gridUnit * 1.5, color: 0x7bd858, alpha: 0.75 }]);
}

/**
 * Одно кольцо досягаемости движения (SPD×N) вокруг токена — рисуется по
 * клику кнопки типа движения (module/combat/movement-actions.mjs).
 * @param {Token} token
 * @param {number} meters
 */
export function showMovementRing(token, meters) {
  if (!(Number(meters) > 0)) return;
  _draw(token, [{ r: Number(meters), color: 0x6fe6ff, alpha: 0.75 }], { timeout: SAFETY_TIMEOUT_MS });
}

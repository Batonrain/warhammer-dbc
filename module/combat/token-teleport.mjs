// module/combat/token-teleport.mjs
// ════════════════════════════════════════════════════════════════════════════
//  ТЕЛЕПОРТ ТОКЕНА СВОЕЙ СПОСОБНОСТЬЮ (Sahara task-bbe1): Тень («Укутанный в
//  Хаос»), Туманоходец, Туманный Прыжок — «разбиться на облако тумана и собраться
//  в другом месте». Два примитива:
//    pickTeleportPoint — интерактивный выбор точки (временный регион, тот же
//      механизм, что placeSmokeZone, regions/difficult-terrain.mjs);
//    teleportToken     — перенос токена в точку не дальше maxMeters: через
//      rules/movement-path.mjs::displaceToken (action «blink» — в истории ядра это
//      телепорт, бюджет лимита пути его не считает; СТЕНЫ ядро проверяет — токен
//      встаёт у стены, как у обычного хода). Прямой update({x, y}) писал бы в
//      историю ходьбу и съедал лимит пути.
// ════════════════════════════════════════════════════════════════════════════

import { pxPerMeter } from "./templates.mjs";
import { tokenCenter } from "./facing.mjs";
import { displaceToken } from "../rules/movement-path.mjs";

/**
 * Точка телепортации — интерактивное размещение (тот же механизм клика по
 * холсту, что уже даёт placeSmokeZone): временный маркер-регион ставится
 * игроком, координаты снимаются, регион тут же удаляется.
 * @returns {Promise<{x:number,y:number}|null>}  null — отмена или нет сцены
 */
export async function pickTeleportPoint() {
  if (!canvas?.ready) return null;
  const region = await canvas.regions.placeRegion({
    name: "Точка телепорта",
    shapes: [{ type: "circle", x: 0, y: 0, radius: 1 }]
  });
  if (!region) return null; // ГМ/игрок отменил размещение (ПКМ)
  const shape = region.shapes?.[0];
  const point = shape ? { x: shape.x, y: shape.y } : null;
  await region.delete();
  return point;
}

/**
 * Перенести токен центром в точку.
 * @param {TokenDocument} tokenDoc
 * @param {{x:number,y:number}} point  центр, пиксели сцены
 * @param {object} [o]
 * @param {number} [o.maxMeters=Infinity]  дальше — отказ без движения (reason «farther»)
 * @param {boolean} [o.walls=true]         упираться в стены (false — сквозь)
 * @returns {Promise<{ok:boolean, reason?:"farther"|"refused", requestedMeters:number,
 *   movedMeters:number, stopped:boolean}>}
 *   stopped — токен остановлен стеной на полпути (ok, но не дошёл)
 */
export async function teleportToken(tokenDoc, point, { maxMeters = Infinity, walls = true } = {}) {
  const center = tokenCenter(tokenDoc);
  const ppm = pxPerMeter() || 1;
  const requestedMeters = Math.hypot(point.x - center.x, point.y - center.y) / ppm;
  if (requestedMeters > maxMeters) return { ok: false, reason: "farther", requestedMeters, movedMeters: 0, stopped: false };

  const size = canvas.grid.size;
  const x0 = tokenDoc.x;
  const y0 = tokenDoc.y;
  const completed = await displaceToken(tokenDoc, {
    x: point.x - ((Number(tokenDoc.width) || 1) * size) / 2,
    y: point.y - ((Number(tokenDoc.height) || 1) * size) / 2
  }, { forced: false, walls });
  // move() вернёт false и когда ядро отклонило перемещение, и когда токен остановила стена
  // на полпути — различаем по положению токена.
  const after = tokenCenter(tokenDoc);
  const movedMeters = Math.hypot(after.x - center.x, after.y - center.y) / ppm;
  const moved = completed || tokenDoc.x !== x0 || tokenDoc.y !== y0;
  if (!moved) return { ok: false, reason: "refused", requestedMeters, movedMeters: 0, stopped: false };
  return { ok: true, requestedMeters, movedMeters, stopped: !completed };
}

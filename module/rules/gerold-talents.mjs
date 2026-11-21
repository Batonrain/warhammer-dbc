// module/rules/gerold-talents.mjs
// ════════════════════════════════════════════════════════════════════════
//  Таланты и Черты Герольда — чистая логика (Foundry-сторона —
//  combat/gerold-talents.mjs).
//
//  Stand Your Ground / Ни Шагу Назад: знамя, воткнутое в землю, — метка на
//    Герольде BANNER_FLAG = { sceneId, x, y } (центр его токена в пикселях
//    сцены). Все соратники, защищающие позицию (та же сторона, не дальше
//    W.b×2 м Герольда от знамени — радиус книги для самого Герольда, взят и
//    для «защищающих позицию»), получают Преимущество на тесты Морали (Страх,
//    Шок, Паника, Подавление — область «morale», rules/resolve-test.mjs).
//    Геометрия — своя копия арифметики (AGENTS.md: источник правил не
//    импортирует combat/facing.mjs и regions/auras.mjs — круг через sources.mjs).
// ════════════════════════════════════════════════════════════════════════

import { hasItemNamed } from "./req-atom.mjs";
import { charBonus } from "./astartes-elite-common.mjs";

const NS = "warhammer-dbc";
export const BANNER_FLAG = "standYourGround";

/** Радиус позиции знамени, м: W.b×2 Герольда. */
export function bannerRadius(herald) {
  return 2 * charBonus(herald, "wp");
}

/** Метры между двумя точками сцены (пиксели → клетки → метры). */
export function metersBetween(a, b, grid = {}) {
  const size = Number(grid.size) || 100;
  const dist = Number(grid.distance) || 1;
  return Math.hypot((a.x ?? 0) - (b.x ?? 0), (a.y ?? 0) - (b.y ?? 0)) / size * dist;
}

/** Метка знамени Герольда или null. */
export function plantedBanner(herald) {
  const f = herald?.flags?.[NS]?.[BANNER_FLAG] ?? herald?.getFlag?.(NS, BANNER_FLAG);
  return f && typeof f === "object" && f.sceneId ? f : null;
}

/**
 * Защищает ли токен позицию знамени этого Герольда (чистая функция).
 * @param {{x:number,y:number,disposition:number}} tok   центр и сторона токена
 * @param {{x:number,y:number,sceneId:string}} banner
 * @param {{disposition:number, radius:number, sceneId:string, grid:object}} o
 */
export function defendsBanner(tok, banner, { disposition, radius, sceneId, grid }) {
  if (!tok || !banner || banner.sceneId !== sceneId) return false;
  if (tok.disposition !== disposition) return false;
  return metersBetween(tok, banner, grid) <= radius;
}

const centerOf = t => ({
  x: t?.center?.x ?? ((t?.document?.x ?? t?.x ?? 0) + (t?.w ?? 0) / 2),
  y: t?.center?.y ?? ((t?.document?.y ?? t?.y ?? 0) + (t?.h ?? 0) / 2),
  disposition: t?.document?.disposition ?? t?.disposition
});

/** Правила Ни Шагу Назад для актора: Преимущество на Мораль у знамени союзного Герольда. */
export function standYourGroundRules(actor) {
  const cv = globalThis.canvas;
  const scene = cv?.scene;
  const tokens = cv?.tokens?.placeables ?? [];
  if (!scene || !tokens.length) return [];
  const mine = tokens.find(t => t.actor === actor || (actor?.uuid && t.actor?.uuid === actor.uuid));
  if (!mine) return [];
  const grid = { size: scene.grid?.size ?? cv.grid?.size, distance: scene.grid?.distance ?? cv.grid?.distance };
  for (const t of tokens) {
    const herald = t.actor;
    const banner = plantedBanner(herald);
    if (!banner || !hasItemNamed(herald, "Stand Your Ground", ["talent"])) continue;
    const ht = centerOf(t);
    if (defendsBanner(centerOf(mine), banner, { disposition: ht.disposition, radius: bannerRadius(herald), sceneId: scene.id, grid })) {
      const label = `🚩 Ни Шагу Назад (знамя ${herald.name}): Преимущество`;
      return [{ id: "astartes.standYourGround", label,
        effects: [{ kind: "rollMode", target: "morale", mode: "keepBest", rolls: 2, label }] }];
    }
  }
  return [];
}

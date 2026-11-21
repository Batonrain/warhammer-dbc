// module/combat/perception-scene.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Foundry-обвязка восприятия (правила — rules/perception.mjs): собирает с
//  живого канваса то, чего чистый модуль знать не может, — стены зрения и
//  звука, источники света и тьмы (полигоны с учётом стен), глобальное
//  освещение, зоны Трудного Ландшафта с галочками «Дым или туман» и «Тьма».
//
//  Всё читается осторожно: нет канваса/поля — функция ctx не задаётся, и
//  rules/perception.mjs отвечает «как без этого знания» (только дальность и
//  сектор). Сцена с выключенным зрением токенов освещения не ведёт: штрафы
//  света тогда не отмечаются сами — их по-прежнему ставит стол галочкой.
// ════════════════════════════════════════════════════════════════════════════

import { lightLevelAt, segmentCrossesZones, perceives, hears } from "../rules/perception.mjs";
import { DIFFICULT_TERRAIN_TYPE } from "../regions/difficult-terrain.mjs";

const canvasReady = () => typeof canvas !== "undefined" && !!canvas?.ready && !!canvas.scene;

function collide(type) {
  const backend = (typeof CONFIG !== "undefined") ? CONFIG.Canvas?.polygonBackends?.[type] : null;
  if (!backend?.testCollision) return undefined;
  return (from, to) => {
    try { return !!backend.testCollision(from, to, { type, mode: "any" }); } catch { return false; }
  };
}

const sourcesOf = coll => [...(coll?.values?.() ?? coll ?? [])];

function sourceShape(s) {
  const d = s.data ?? {};
  const shape = s.shape;
  return {
    x: Number(d.x) || 0, y: Number(d.y) || 0,
    bright: Number(d.bright) || 0, dim: Number(d.dim) || 0,
    radius: Math.max(Number(d.radius) || 0, Number(d.dim) || 0, Number(d.bright) || 0) || undefined,
    contains: shape?.contains ? p => shape.contains(p.x, p.y) : undefined
  };
}

/** Зоны Трудного Ландшафта с включённой галочкой `prop` («smoke» / «dark»). */
export function terrainZones(prop) {
  if (!canvasReady()) return [];
  const out = [];
  for (const region of canvas.scene.regions ?? []) {
    const on = [...(region.behaviors ?? [])].some(b => b.type === DIFFICULT_TERRAIN_TYPE && !b.disabled && b.system?.[prop]);
    if (!on || typeof region.testPoint !== "function") continue;
    out.push({ contains: p => { try { return !!region.testPoint({ x: p.x, y: p.y, elevation: p.elevation ?? 0 }); } catch { return false; } } });
  }
  return out;
}

/** Освещение сцены для rules/perception.mjs::lightLevelAt. */
export function sceneLightEnv() {
  if (!canvasReady()) return { tracked: false };
  const scene = canvas.scene;
  if (scene.tokenVision === false) return { tracked: false };
  const global = canvas.environment?.globalLightSource;
  const lights = sourcesOf(canvas.effects?.lightSources)
    .filter(s => s && s !== global && s.active !== false && !s.isPreview)
    .map(sourceShape);
  const darkness = sourcesOf(canvas.effects?.darknessSources)
    .filter(s => s && s.active !== false)
    .map(sourceShape);
  return {
    tracked: true,
    globalLight: !!global?.active,
    globalBright: scene.environment?.globalLight?.bright !== false,
    lights, darkness,
    darkZones: terrainZones("dark")
  };
}

/** Функции живой сцены для rules/perception.mjs (perceives/hears). */
export function liveCtx() {
  if (!canvasReady()) return {};
  const env = sceneLightEnv();
  const smoke = terrainZones("smoke");
  return {
    sightBlocked: collide("sight"),
    soundBlocked: collide("sound"),
    lightAt: env.tracked ? p => lightLevelAt(p, env) : undefined,
    smokeBetween: smoke.length ? (a, b) => segmentCrossesZones(a, b, smoke) : undefined
  };
}

const docOf = t => t?.document ?? t;
const gridOf = () => canvas.scene?.grid ?? canvas.grid;

/** Документы из `candidates`, которые воспринимают `target` (зрением или чувствами). */
export function tokensThatPerceive(target, candidates) {
  if (!canvasReady()) return [];
  const ctx = liveCtx();
  const t = docOf(target);
  return (candidates ?? []).map(docOf).filter(c => c && c.id !== t?.id && perceives(c, t, gridOf(), ctx).seen);
}

/** Документы из `candidates`, которые видят ИЛИ слышат `source`. */
export function tokensThatSeeOrHear(source, candidates) {
  if (!canvasReady()) return [];
  const ctx = liveCtx();
  const s = docOf(source);
  return (candidates ?? []).map(docOf).filter(c => c && c.id !== s?.id
    && (perceives(c, s, gridOf(), ctx).seen || hears(c, s, gridOf(), ctx)));
}

/**
 * Что сцена говорит о видимости для окна атаки: освещённость у цели и дым
 * на линии огня. null-поля — сцена этого не знает (галочки остаются ручными).
 * @returns {{light: string|null, smoke: boolean}}
 */
export function attackVisibility(attackerToken, targetToken) {
  if (!canvasReady() || !attackerToken || !targetToken) return { light: null, smoke: false };
  const a = attackerToken.center ?? null;
  const b = targetToken.center ?? null;
  if (!a || !b) return { light: null, smoke: false };
  const env = sceneLightEnv();
  const smoke = terrainZones("smoke");
  return { light: lightLevelAt(b, env), smoke: segmentCrossesZones(a, b, smoke) };
}

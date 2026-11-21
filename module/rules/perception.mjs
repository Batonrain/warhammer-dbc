// module/rules/perception.mjs
// ════════════════════════════════════════════════════════════════════════════
//  ВОСПРИЯТИЕ: видит ли / слышит ли наблюдатель цель (wdbc-1rno.36, #578,
//  #584, #588, wdbc-1rno.10). ОДИН ответ для всех потребителей — Живого Стяга,
//  свидетелей Атраментара, штрафов освещения и дыма в окне атаки.
//
//  Чистая логика без Foundry: всё, что знает только живой канвас (стены,
//  источники света, зоны дыма), приходит сюда функциями в `ctx`
//  (combat/perception-scene.mjs их собирает). Без `ctx` ответ совпадает со
//  старым геометрическим rules/vision-target.mjs::isTokenInSight — дальность
//  и сектор обзора, ничего больше: тесты и сцены без стен ведут себя как раньше.
//
//  Книга (core):
//   • освещённость четырёх ступеней «Ослепительный > Яркий > Слабый > Тьма»
//     (Нимб Тьмы); стандартные модификаторы атаки — Слабый свет −10 стрелковой,
//     Дым/туман −10/−20, Тьма −20/−30;
//   • Dark Sight — «видит во тьме так же хорошо, как на свету»;
//   • Sonar Sense — «ощущает … в радиусе 30м с круговым обзором … засекает
//     врагов сквозь стены, если они не в запертой комнате»;
//   • Unnatural Senses (X) — «круговое зрение с дальностью Х м»;
//   • Sight Beyond Barriers (X) — Глаза Хаоса 10: видит сквозь преграды на X м;
//   • Зрящие Рога (Величественные Рога, 9) — «видит сквозь рога как через
//     перископы»: обзор назад — круговой сектор (vision-aids.mjs::hornSightActive);
//   • Оглохший «не может слышать».
//
//  Слух (Живой Стяг «видеть или слышать», Погребальная Песнь «в 30 м, что
//  способны слышать»): голос слышен на VOICE_RANGE_M, если между ними нет
//  стены, глушащей звук (стены Foundry с ограничением звука). Число книга не
//  даёт — 30 м взято у Погребальной Песни (вопрос-догадка, отчёт 2-D).
// ════════════════════════════════════════════════════════════════════════════

import { tokenDocDistance } from "../regions/auras.mjs";
import { isWithinArc, bearingDegrees, facingBearing } from "./facing.mjs";
import { sightRangeOf } from "./vision-target.mjs";
import { itemHasName, isBlindedActor, manifestedGift, blindsightActive } from "./predicates.mjs";
import { hasRuleFlag } from "./flags.mjs";
import { liveTraitRating } from "./flight-speed.mjs";
import { mechRollData } from "./mech-formula.mjs";
import { hasBlackEyesDarknessImmunity } from "./black-eyes.mjs";
import { hornSightActive, visionAidBlocked } from "./vision-aids.mjs";
import { itemIs } from "./item-marker.mjs";
import { manyEyedSightAngle } from "./possession-talents.mjs";
import { bloodSmokeSight } from "./blood-replacement.mjs";
import { headlessSightAngle } from "./headless.mjs";

/** Ступени освещённости книги (Нимб Тьмы). */
export const LIGHT = Object.freeze({ blinding: "blinding", bright: "bright", dim: "dim", dark: "dark" });
export const LIGHT_LABELS = Object.freeze({ blinding: "Ослепительный", bright: "Яркий", dim: "Слабый", dark: "Тьма" });

export const SONAR_RANGE_M = 30;
export const VOICE_RANGE_M = 30;

const num = v => (Number.isFinite(Number(v)) ? Number(v) : 0);
const dist2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

// ── Освещённость ──────────────────────────────────────────────────────────────

/**
 * Освещённость в точке сцены.
 * @param {{x:number,y:number}} p
 * @param {object} env
 * @param {boolean} [env.tracked=true]   false — сцена без зрения токенов: освещение не ведётся, ответ null
 * @param {boolean} [env.globalLight]    глобальное освещение сейчас действует
 * @param {boolean} [env.globalBright]   …и даёт яркий, а не слабый свет
 * @param {Array<{x,y,bright,dim,contains?:Function}>} [env.lights]  радиусы в пикселях; contains — полигон со стенами
 * @param {Array<{x,y,radius?,contains?:Function}>} [env.darkness]   источники тьмы
 * @param {Array<{contains:Function}>} [env.darkZones]               зоны с галочкой «Тьма» (Трудный Ландшафт)
 * @returns {"bright"|"dim"|"dark"|null}
 */
export function lightLevelAt(p, env = {}) {
  if (!p || env.tracked === false) return null;
  const inside = (s, r) => (s.contains ? s.contains(p) : true) && (r === undefined || dist2(s, p) <= r * r);
  if ((env.darkness ?? []).some(s => inside(s, s.radius))) return LIGHT.dark;
  if ((env.darkZones ?? []).some(z => z.contains?.(p))) return LIGHT.dark;
  const lights = env.lights ?? [];
  if (lights.some(s => num(s.bright) > 0 && inside(s, num(s.bright)))) return LIGHT.bright;
  if (env.globalLight) return env.globalBright === false ? LIGHT.dim : LIGHT.bright;
  if (lights.some(s => num(s.dim) > 0 && inside(s, Math.max(num(s.dim), num(s.bright))))) return LIGHT.dim;
  return LIGHT.dark;
}

/** Строка окна атаки, отмечаемая освещением: «light-dim» → Слабый свет, «light-dark» → Тьма. */
export function lightPenaltyKey(level) {
  if (level === LIGHT.dim) return "dim";
  if (level === LIGHT.dark) return "dark";
  return null;
}

/**
 * Проходит ли отрезок a→b через зону (дым/туман): концы и точки через каждые
 * `stepPx` пикселей. Сэмпл, а не пересечение фигур: Region даёт только testPoint.
 */
export function segmentCrossesZones(a, b, zones, stepPx = 25) {
  if (!a || !b || !zones?.length) return false;
  const len = Math.sqrt(dist2(a, b));
  const n = Math.max(1, Math.ceil(len / Math.max(1, stepPx)));
  for (let i = 0; i <= n; i++) {
    const p = { x: a.x + (b.x - a.x) * i / n, y: a.y + (b.y - a.y) * i / n };
    if (zones.some(z => z.contains?.(p))) return true;
  }
  return false;
}

// ── Чувства актора ───────────────────────────────────────────────────────────

const SONAR_NAMES = ["Sonar Sense", "Sonar Senses", "Сонарное Чувство"];
const UNNATURAL_NAMES = ["Unnatural Senses", "Сверхъестественные Чувства"];
const BARRIER_NAMES = ["Sight Beyond Barriers", "Взор сквозь Преграды"];
const SENSE_TYPES = new Set(["trait", "talent", "mutation"]);

function ratedItem(actor, names) {
  return [...(actor?.items ?? [])].find(i => SENSE_TYPES.has(i?.type) && names.some(n => itemHasName(i, n))) ?? null;
}

function liveRating(actor, item) {
  if (!item) return 0;
  try { return num(liveTraitRating(item, mechRollData(actor))) || num(item.system?.rating); } catch { return num(item.system?.rating); }
}

/**
 * Чувства актора, важные для восприятия. Дальности в метрах, 0 — чувства нет.
 * @returns {{darkSight:boolean, thermal:boolean, smokeSight:boolean, sonar:number, unnatural:number,
 *   barrier:number, hornSight:boolean, blind:boolean, deaf:boolean}}
 */
export function sensesOf(actor) {
  const items = [...(actor?.items ?? [])];
  const blackEyes = hasBlackEyesDarknessImmunity(actor);
  const darkSight = blackEyes || items.some(i => itemIs(i, "trait", "trait.darkSight", "Dark Sight"));
  // Охотничий Визор — тепловое зрение («игнорирует штрафы за плохое освещение»), пока надет и не погашен Рогами.
  const thermal = items.some(i => itemIs(i, "gear", null, "Preysense Visor") && i.system?.equipped && !visionAidBlocked(i));
  const sonarItem = ratedItem(actor, SONAR_NAMES);
  const sonar = sonarItem || hasRuleFlag(actor, "trait.sonarSense") ? SONAR_RANGE_M : 0;
  const unItem = ratedItem(actor, UNNATURAL_NAMES);
  let unnatural = unItem ? liveRating(actor, unItem) : 0;
  if (!unnatural && (unItem || hasRuleFlag(actor, "trait.unnaturalSenses") || manifestedGift(actor, "Варп-Зрение")))
    unnatural = Math.max(0, num(actor?.system?.characteristics?.per?.bonus)) || 1;
  // Слепое Зрение: Unnatural Senses (P.b) без шлема.
  if (blindsightActive(actor)) unnatural = Math.max(unnatural, num(actor?.system?.characteristics?.per?.bonus));
  const barrier = liveRating(actor, ratedItem(actor, BARRIER_NAMES));
  const c = actor?.system?.conditions ?? {};
  return {
    darkSight, thermal, smokeSight: blackEyes || bloodSmokeSight(actor), sonar, unnatural, barrier,
    hornSight: hornSightActive(actor),
    blind: isBlindedActor(actor),
    deaf: !!c.deafened
  };
}

/**
 * Угол обзора токена с поправками актора: Многоглазый (Проявление) и Зрящие
 * Рога — круговой, Безголовый — не шире 120°. 0/пусто — как задано (вызвавший
 * сам решает, что такое «не настроено»).
 */
export function effectiveSightAngle(actor, rawAngle) {
  let a = manyEyedSightAngle(actor, rawAngle);
  if (actor && hornSightActive(actor)) a = 360;
  return headlessSightAngle(actor, a);
}

// ── Видит ли ──────────────────────────────────────────────────────────────────

function tokenCenter(t, gridSize) {
  return {
    x: num(t.x) + (num(t.width) || 1) * gridSize / 2,
    y: num(t.y) + (num(t.height) || 1) * gridSize / 2
  };
}

/**
 * Воспринимает ли наблюдатель цель и чем.
 * @param {object} observerDoc  TokenDocument-подобный (x,y,width,height,rotation,elevation,sight,actor)
 * @param {object} targetDoc
 * @param {{size:number,distance:number}} grid
 * @param {object} [ctx]
 * @param {object} [ctx.senses]             sensesOf(observer.actor) — иначе посчитается
 * @param {Function} [ctx.sightBlocked]     (from,to)→bool: стена закрывает обзор
 * @param {Function} [ctx.lightAt]          (point)→LIGHT|null
 * @param {Function} [ctx.smokeBetween]     (from,to)→bool
 * @returns {{seen:boolean, by:string|null, why:string}}
 */
export function perceives(observerDoc, targetDoc, grid, ctx = {}) {
  if (!observerDoc || !targetDoc) return { seen: false, by: null, why: "нет токена" };
  const actor = observerDoc.actor ?? null;
  const senses = ctx.senses ?? (actor ? sensesOf(actor) : {});
  const size = num(grid?.size) || 100;
  const d = tokenDocDistance(observerDoc, targetDoc, grid);
  const from = tokenCenter(observerDoc, size);
  const to = tokenCenter(targetDoc, size);
  const walled = !!ctx.sightBlocked?.(from, to);

  // Сонар: круговой, 30 м, сквозь стены (запертую комнату решает ГМ), без света.
  if (senses.sonar && d <= senses.sonar) return { seen: true, by: "sonar", why: "Сонарное Чувство" };
  // Сверхъестественные Чувства: круговое «зрение» на X м — стены, как у зрения, его держат.
  if (senses.unnatural && d <= senses.unnatural && !walled)
    return { seen: true, by: "unnatural", why: "Сверхъестественные Чувства" };
  if (senses.blind) return { seen: false, by: null, why: "ослеплён" };

  if (d > sightRangeOf(observerDoc)) return { seen: false, by: null, why: "далеко" };
  const raw = num(observerDoc.sight?.angle);
  const angle = effectiveSightAngle(actor, raw);
  if (angle && angle < 360 && (from.x !== to.x || from.y !== to.y)
      && !isWithinArc(facingBearing(observerDoc.rotation), bearingDegrees(from, to), angle))
    return { seen: false, by: null, why: "вне сектора обзора" };
  const throughBarrier = walled && senses.barrier > 0 && d <= senses.barrier;
  if (walled && !throughBarrier) return { seen: false, by: null, why: "за стеной" };
  if (!(senses.smokeSight) && ctx.smokeBetween?.(from, to)) return { seen: false, by: null, why: "дым" };
  const light = ctx.lightAt?.(to) ?? null;
  if (light === LIGHT.dark && !senses.darkSight && !senses.thermal) return { seen: false, by: null, why: "тьма" };
  return { seen: true, by: throughBarrier ? "barrier" : "sight", why: throughBarrier ? "Взор сквозь Преграды" : "зрение" };
}

/**
 * Слышит ли слушатель голос источника: не оглох, в VOICE_RANGE_M (или `range`)
 * и звук не глушит стена (ctx.soundBlocked).
 */
export function hears(listenerDoc, sourceDoc, grid, ctx = {}) {
  if (!listenerDoc || !sourceDoc) return false;
  const senses = ctx.senses ?? (listenerDoc.actor ? sensesOf(listenerDoc.actor) : {});
  if (senses.deaf) return false;
  const range = ctx.range ?? VOICE_RANGE_M;
  if (tokenDocDistance(listenerDoc, sourceDoc, grid) > range) return false;
  const size = num(grid?.size) || 100;
  return !ctx.soundBlocked?.(tokenCenter(sourceDoc, size), tokenCenter(listenerDoc, size));
}

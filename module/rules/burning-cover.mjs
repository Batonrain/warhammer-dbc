// module/rules/burning-cover.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Горящие укрытия — вторая половина Таланта «Pyromaniac / Пироман» (Sahara
//  3-8318, решение владельца 25.10.2026). Чистые функции: Foundry, сцены и
//  бросков здесь нет; обвязка (Region, сокет, бой) — combat/burning-cover.mjs.
//
//  Книга: «Все укрытия, попавшие в шаблон огнемета, также загораются на 1d5+1
//  Раундов и персонаж, заканчивающий свой Ход в горящем укрытии, также
//  автоматически загорается».
//
//  Модель (минимальная, без нового объекта «укрытие» и без износа): укрытие в
//  системе — Region с поведением cover (regions/cover.mjs). Состояние «горит» —
//  флаг на самом Region: { untilRound, combatId, prev }.
//    · горит, пока раунд боя < untilRound (untilRound = раунд поджога + 1d5+1);
//    · prev — прежние цвет и видимость зоны, чтобы после пожара вернуть как было;
//    · подсветка на карте — штатные свойства Region (цвет и «видна всем»), без
//      собственной отрисовки.
//  Флаг «чужого боя» (combatId не совпал) считается погасшим: бой кончился, а
//  зона осталась в сцене.
// ════════════════════════════════════════════════════════════════════════════

export const BURNING_COVER_NS = "warhammer-dbc";
export const BURNING_COVER_FLAG = "burningCover";
/** «на 1d5+1 Раундов» */
export const BURNING_COVER_DURATION = "1d5+1";
/** Цвет горящей зоны на карте. */
export const BURNING_COVER_COLOR = "#ff4a14";
/** CONST.REGION_VISIBILITY.ALWAYS (common/constants.mjs) — зона видна всем, а не только на слое Регионов. */
export const REGION_VISIBILITY_ALWAYS = 2;
/** CONST.REGION_VISIBILITY.LAYER_UNLOCKED — умолчание схемы, если прежнее значение не сохранилось. */
const REGION_VISIBILITY_DEFAULT = 4;

/** Раунд, с которого укрытие уже НЕ горит: раунд поджога + выпавшие Раунды. */
export function burningCoverUntil(round, duration) {
  return (Number(round) || 0) + Math.max(1, Number(duration) || 1);
}

/** Горит ли укрытие с таким флагом прямо сейчас (в этом бою, раньше срока). */
export function isCoverBurning(flag, { round, combatId }) {
  if (!flag || typeof flag !== "object") return false;
  if (flag.combatId && combatId && flag.combatId !== combatId) return false;
  return (Number(round) || 0) < (Number(flag.untilRound) || 0);
}

/** Раунд, в котором только что закончился Ход: смена хода через конец раунда уже подняла combat.round. */
export function turnEndRound(combatRound, changed) {
  const r = Number(combatRound) || 0;
  return changed?.round !== undefined ? Math.max(0, r - 1) : r;
}

/** Цвет Region строкой (в v14 поле — объект Color с .css). */
function colorString(c) {
  return c?.css ?? (c == null ? "" : String(c));
}

/**
 * Правка Region, поджигающая укрытие. Повторный поджог продлевает срок (берётся
 * больший), а прежний вид зоны запоминается ТОЛЬКО с первого раза — иначе
 * «прежним» стал бы уже огненный цвет.
 * @param {{color?:any, visibility?:number, flags?:object}} region
 * @param {{untilRound:number, combatId:string}} opts
 */
export function coverIgnitionPatch(region, { untilRound, combatId }) {
  const cur = region?.flags?.[BURNING_COVER_NS]?.[BURNING_COVER_FLAG];
  const prev = cur?.prev ?? {
    color: colorString(region?.color),
    visibility: Number.isFinite(region?.visibility) ? region.visibility : REGION_VISIBILITY_DEFAULT
  };
  return {
    color: BURNING_COVER_COLOR,
    visibility: REGION_VISIBILITY_ALWAYS,
    [`flags.${BURNING_COVER_NS}.${BURNING_COVER_FLAG}`]: {
      untilRound: Math.max(Number(untilRound) || 0, Number(cur?.untilRound) || 0),
      combatId: combatId ?? cur?.combatId ?? "",
      prev
    }
  };
}

/** Правка Region, возвращающая зону в прежний вид и снимающая флаг. */
export function coverExtinguishPatch(flag) {
  const patch = { [`flags.${BURNING_COVER_NS}.-=${BURNING_COVER_FLAG}`]: null };
  if (flag?.prev?.color) patch.color = flag.prev.color;
  patch.visibility = Number.isFinite(flag?.prev?.visibility) ? flag.prev.visibility : REGION_VISIBILITY_DEFAULT;
  return patch;
}

/**
 * Пересекаются ли две зоны — по сетке точек в прямоугольнике первой. Region не
 * даёт готового пересечения двух фигур (тот же приём, что у Базы токена в
 * combat/templates.mjs::tokensInRegion), поэтому берётся сэмпл точек: засчитано,
 * если хоть одна точка внутри обеих. Шаг растёт, чтобы точек было не больше
 * `maxSamples` (большая зона не должна вешать клиент).
 * @param {{x:number,y:number,width:number,height:number}} bounds  прямоугольник зоны A
 * @param {number} step  желаемый шаг сетки, px
 * @param {(x:number,y:number)=>boolean} inA
 * @param {(x:number,y:number)=>boolean} inB
 */
export function regionsOverlapBySampling(bounds, step, inA, inB, maxSamples = 2500) {
  const w = Math.max(0, Number(bounds?.width) || 0), h = Math.max(0, Number(bounds?.height) || 0);
  if (!w || !h) return false;
  let s = Math.max(1, Number(step) || 25);
  while ((Math.floor(w / s) + 1) * (Math.floor(h / s) + 1) > maxSamples) s *= 1.5;
  // Края включаются: тонкая полоса укрытия уже шага сетки иначе проскочила бы между точками.
  const xs = [], ys = [];
  for (let x = 0; x < w; x += s) xs.push(bounds.x + x);
  for (let y = 0; y < h; y += s) ys.push(bounds.y + y);
  xs.push(bounds.x + w); ys.push(bounds.y + h);
  for (const x of xs) for (const y of ys) {
    if (inA(x, y) && inB(x, y)) return true;
  }
  return false;
}

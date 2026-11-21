// module/rules/spatial-instability.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Пространственная Нестабильность / Spatial Instability (Общие мутации,
//  wdbc-1rno.8) — чистая логика. Обвязка — combat/spatial-instability.mjs.
//
//  «Раз в 12−Cor.b часов он может за свободное действие получить Трейт
//  Incorporeal на Cor.b Раундов, или пока он не решит вернуться в реальность
//  свободным действием.»  Частота — формулой от Cor.b, поэтому не общий
//  throttle Конструктора (тот знает только число), а свой worldTime-откат на
//  предмете (rules/cooldown.mjs::isWorldTimeCooldownReady).
// ════════════════════════════════════════════════════════════════════════════

export const SPATIAL_COOLDOWN_FLAG = "spatialInstabilityUsedAt";
/** Метка выдачи на Чертах Бесплотности (вместе с tempGrant): кто их выдал. */
export const SPATIAL_GRANT_FLAG = "spatialInstabilityGrant";
/** Ходок Снов (субм. 6): сколько Раундов оставалось, когда таймер встал. */
export const SPATIAL_DREAM_FLAG = "spatialInstabilityDream";
/** Ненависть сквозь Завесу (субм. 8): разрешение одной рукопашной атаки по материальной цели. */
export const VEIL_PIERCE_FLAG = "veilPierce";

/** Откат в секундах: (12 − Cor.b) часов, не меньше нуля (Cor.b 12+ — без отката). */
export function spatialCooldownSeconds(corBonus) {
  return Math.max(0, 12 - (Number(corBonus) || 0)) * 3600;
}

/**
 * Строка субмутации → вид. Подписи хранятся диапазонами («2-3») и числами.
 * @returns {"extend"|"fly"|"fear"|"dream"|"destroyer"|"hatred"|"warpPower"|"breach"|""}
 */
export function spatialSubKind(label) {
  const m = String(label ?? "").trim().match(/^(\d+)(?:\s*[-–—]\s*(\d+))?/);
  if (!m) return "";
  const lo = Number(m[1]);
  return ({ 1: "extend", 2: "fly", 3: "fly", 4: "fear", 5: "fear", 6: "dream", 7: "destroyer",
            8: "hatred", 9: "warpPower", 10: "breach" })[lo] ?? "";
}

/**
 * Продление (субм. 1): +Cor.b Раундов к сроку метки. Возвращает новую метку
 * или null, если срок не в Раундах (снимать нечего).
 */
export function extendTempGrant(tempGrant, corBonus) {
  if (!tempGrant || tempGrant.unit !== "round") return null;
  return { ...tempGrant, expiresAtRound: Number(tempGrant.expiresAtRound) + Math.max(0, Number(corBonus) || 0) };
}

/**
 * Ходок Снов (субм. 6): «пока он находится внутри снов, счётчик времени на
 * Бесплотность останавливается». Вход — запоминаем остаток Раундов и
 * отодвигаем срок далеко вперёд; выход — срок = текущий Раунд + остаток.
 */
export function dreamPause(tempGrant, round) {
  const left = Math.max(0, Number(tempGrant?.expiresAtRound) - Number(round));
  return { left, tempGrant: { ...tempGrant, expiresAtRound: Number(round) + 100000 } };
}
export function dreamResume(tempGrant, round, left) {
  return { ...tempGrant, expiresAtRound: Number(round) + Math.max(0, Number(left) || 0) };
}

/**
 * Пробой Завесы (субм. 8): бесплотный атакует материальную цель рукопашной.
 * Разрешение — флаг на атакующем {targetUuid, melee:true}; гасит его первая же
 * такая атака (sheets/attack/dialog.mjs).
 */
export function veilPierceAllows(pierce, targetUuid, isMelee) {
  return !!pierce && !!isMelee && !!targetUuid && pierce.targetUuid === targetUuid;
}

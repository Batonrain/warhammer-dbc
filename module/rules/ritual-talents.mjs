// module/rules/ritual-talents.mjs
// ════════════════════════════════════════════════════════════════════════════
//  ЦЕНА РИТУАЛА НА КАРТОЧКЕ и Таланты Оккультиста, которые её трогают
//  (остаток Талантов, 20.11.2026). Чистая часть, без Foundry.
//
//  «Цена» и «Цена ошибки» предмета-ритуала — проза книги (system.cost /
//  failureCost, data/item/ritual.mjs). Раньше карточка ритуала их не показывала
//  вовсе, а кубики внутри («+1d5 Порчи», «3d10 урона в W») игрок кидал руками.
//  Теперь карточка (apps/ritual-cast.mjs) выводит нужный текст и бросает каждый
//  кубик прямо в строке. На это ложатся три Таланта:
//
//  - Warprod / Варпоотвод: «делает все броски на цену ритуала 2 раза, выбирая
//    один» — каждый кубик цены бросается дважды, берётся меньший (цена — всегда
//    вред ритуалисту: Порча, урон, Усталость, бонус Феномена), второй виден.
//  - Scapegoat / Козёл Отпущения: подготовленная за смену жертва для
//    определённого ритуала — цена/цена ошибки этого ритуала ложится на неё.
//    Метка на ритуалисте { ritualName, uuid, name }, снимается проведением.
//  - Divine Mask / Божественная Маска: 15 минут и 1 ОБ — на Cor.b часов
//    покровительство выбранного Бога для ритуалов и Владычества. Читается
//    autoSummonMods (Модификаторы Призыва). Выдавая себя за слугу враждебного
//    своему Бога — +1d5 Порчи при любом исходе ритуала.
//  - Brainwashing / Промывка Мозгов: встречный Interrogate vs W — жертва
//    добровольно участвует в одном ритуале. Метка на ритуалисте (список жертв),
//    карточка ритуала называет добровольцев и снимает метку.
// ════════════════════════════════════════════════════════════════════════════

import { hasItemNamed } from "./req-atom.mjs";

const NS = "warhammer-dbc";
export const SCAPEGOAT_FLAG = "scapegoat";
export const DIVINE_MASK_FLAG = "divineMask";
export const BRAINWASHED_FLAG = "brainwashed";

export const hasWarprod = actor => hasItemNamed(actor, "Warprod", ["talent"]);
export const hasScapegoat = actor => hasItemNamed(actor, "Scapegoat", ["talent"]);
export const hasDivineMask = actor => hasItemNamed(actor, "Divine Mask", ["talent"]);
export const hasBrainwashing = actor => hasItemNamed(actor, "Brainwashing", ["talent"]);

const flagOf = (actor, key) => actor?.flags?.[NS]?.[key] ?? null;

/** Кубики в прозе цены: «1d5», «3d10», «2d10+5» (латинская d или кириллическая д). */
export const COST_DICE_RE = /(\d+)[dд](\d+)(\s*[+\-−]\s*\d+(?![dд\d]))?/g;

/**
 * Разбить прозу на куски: строки и кубики.
 * @returns {Array<{text:string}|{formula:string, raw:string}>}
 */
export function splitCostDice(text) {
  const src = String(text ?? "");
  const out = [];
  let last = 0;
  for (const m of src.matchAll(COST_DICE_RE)) {
    if (m.index > last) out.push({ text: src.slice(last, m.index) });
    const n = m[1];
    const tail = (m[3] || "").replace(/\s+/g, "").replace("−", "-");
    out.push({ formula: `${n}d${m[2]}${tail}`, raw: m[0] });
    last = m.index + m[0].length;
  }
  if (last < src.length) out.push({ text: src.slice(last) });
  return out;
}

/** Варпоотвод: из двух бросков цены берётся меньший. */
export function warprodPick(a, b) {
  return Math.min(Number(a) || 0, Number(b) || 0);
}

/** Какой текст цены показывать: при Успехе — «Цена», при Провале — «Цена ошибки». */
export function ritualCostText(item, success) {
  const s = item?.system ?? {};
  const t = String((success ? s.cost : s.failureCost) ?? "").trim();
  if (!t || /^нет\.?$/i.test(t)) return "";
  return t;
}

/** Подготовленный Козёл Отпущения для этого ритуала (сравнение по имени ритуала). */
export function scapegoatFor(actor, ritualName) {
  const s = flagOf(actor, SCAPEGOAT_FLAG);
  if (!s?.uuid || !hasScapegoat(actor)) return null;
  const norm = v => String(v ?? "").trim().toLowerCase();
  return norm(s.ritualName) && norm(s.ritualName) === norm(ritualName) ? s : null;
}

/**
 * Действующая Божественная Маска: { god, until } или null (нет, истекла).
 * @param {number} now  worldTime, секунды
 */
export function divineMaskGod(actor, now) {
  const m = flagOf(actor, DIVINE_MASK_FLAG);
  if (!m?.god || !hasDivineMask(actor)) return null;
  if (Number(m.until) <= Number(now)) return null;
  return m;
}

/** Срок Маски: Cor.b часов (минимум 1). */
export function divineMaskSeconds(actor) {
  return Math.max(1, Number(actor?.system?.corruptionBonus) || 0) * 3600;
}

/** Промытые жертвы ритуалиста: [{uuid, name}]. */
export function brainwashedList(actor) {
  const l = flagOf(actor, BRAINWASHED_FLAG);
  return Array.isArray(l) ? l.filter(e => e?.uuid) : [];
}

/** Кто из ассистентов этого ритуала участвует по Промывке Мозгов. */
export function brainwashedAssistants(actor, assistantList = []) {
  const set = new Set(brainwashedList(actor).map(e => e.uuid));
  return (assistantList ?? []).filter(a => a?.uuid && set.has(a.uuid));
}

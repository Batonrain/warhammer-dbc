// module/rules/merge-abilities.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Склейка одинаковых Талантов и Черт для показа на листе.
//
//  Источников у персонажа много — Раса, Легион, Архетип, Происхождение,
//  Стремления, — и один и тот же Талант приходит от нескольких сразу. Предметы
//  при этом остаются РАЗНЫМИ: каждый помнит своего выдавшего (флаг
//  `grantedByItem`) и снимается вместе с ним, а цена в опыте считается по
//  каждой покупке отдельно. Склеивается только показ:
//
//    Nimble (5) + Nimble (5)                       → Nimble (10)
//    Resistance (Cold) + (Heat) + (Poison)         → Resistance (Cold, Heat, Poison)
//
//  Числовая механика от склейки не зависит и складывается сама: эффекты
//  применяются с каждого предмета (documents/actor.mjs), поэтому показанная
//  сумма — это ровно то, что уже действует.
//
//  Вкладка «Развитие» этой склейкой не пользуется намеренно: там считают опыт,
//  и каждая специализация — своя покупка со своей ценой.
//
//  Foundry здесь нет: функции берут обычные объекты вида предмета и проверяются
//  без заглушки (test/rules/merge-abilities.test.mjs).
// ════════════════════════════════════════════════════════════════════════════

import { isMinionTalent } from "./minion-build.mjs";

/**
 * Хвостовая скобка с рейтингом: «Nimble (10)», «Сверхъест. Сила (X)».
 * Только число или заглушка X — латинская и русская, в паках встречаются обе.
 * Скобка с текстом («Weapon Training (Bolt)») не трогается: там записана
 * специализация, и две такие Черты — разные вещи, а не одна с суммой.
 */
const RATING_TAIL = /\s*\((?:\d+|[xхXХ])\)\s*$/;

/** Убрать хвостовой рейтинг у каждой половины двуязычного имени. */
function stripRatingTail(name) {
  return String(name ?? "").split("/")
    .map(part => part.replace(RATING_TAIL, "").trim())
    .join(" / ");
}

/**
 * Ключ склейки. Имена двуязычны («Nimble / Проворный»), рейтинг у разных рас
 * записан то в имени, то только в поле — сравниваем без него и без регистра.
 */
export function mergeKey(name) {
  return stripRatingTail(name).toLowerCase();
}

/**
 * Чем этот предмет отличается от однофамильцев: специализация и цели.
 *
 * Цели (`targets` у Таланта — Hatred, Enemy, Peer) идут в тот же список: книга
 * пишет их ровно так же, одной скобкой через запятую — «Hatred (Dark
 * Mechanicum, Adeptus Mechanicus, Vehicles)».
 */
export function itemSpecs(item) {
  const s = item?.system ?? {};
  // «Миньон Хаоса» (apps/minion-talent.mjs) кладёт в specialization ОДНУ
  // составную метку «Группа, Сила» («Демон, Высший») — не список нескольких
  // специализаций через запятую, как у остальных Талантов. Обычное
  // split(",") резало её на два бессмысленных обрывка и при нескольких
  // покупках с разными парами сливало всё в кашу без счёта — «неверное
  // количество взятых миньонов» (wdbc-cof).
  const fromSpec = isMinionTalent(item)
    ? [String(s.specialization ?? "").trim()]
    : String(s.specialization ?? "").split(",").map(x => x.trim());
  const fromTargets = (Array.isArray(s.targets) ? s.targets : []).map(t => String(t?.name ?? "").trim());
  return [...fromSpec, ...fromTargets].filter(Boolean);
}

/**
 * Свести одинаковые Таланты (или Черты) в строки листа.
 *
 * @param {Array} items предметы одного типа
 * @returns {Array<object>} строки в порядке первого появления:
 *   { key, items, first, id, baseName, specs, hasRating, rating,
 *     hasRating2, rating2, ratingText }
 */
export function mergeAbilityItems(items = []) {
  const groups = new Map();

  for (const [idx, item] of [...items].entries()) {
    // Предмет без имени склеивать не с чем: пустой ключ слил бы в одну строку
    // все безымянные заготовки, которые игрок только что создал кнопкой «＋».
    const key = mergeKey(item?.name) || `#${item?.id ?? idx}`;

    let g = groups.get(key);
    if (!g) {
      g = {
        key, items: [], first: item, id: item?.id,
        baseName: stripRatingTail(item?.name), specs: [],
        hasRating: false, rating: 0, hasRating2: false, rating2: 0
      };
      groups.set(key, g);
    }

    g.items.push(item);
    const s = item?.system ?? {};
    if (s.hasRating)  { g.hasRating  = true; g.rating  += Number(s.rating)  || 0; }
    if (s.hasRating2) { g.hasRating2 = true; g.rating2 += Number(s.rating2) || 0; }
    for (const spec of itemSpecs(item)) if (!g.specs.includes(spec)) g.specs.push(spec);
  }

  for (const g of groups.values()) g.ratingText = ratingText(g);
  return [...groups.values()];
}

/** Подпись рейтинга строки: «(10)», «(10/2)» либо пусто. */
function ratingText(g) {
  if (!g.hasRating && !g.hasRating2) return "";
  if (g.hasRating && g.hasRating2) return `(${g.rating}/${g.rating2})`;
  return `(${g.hasRating ? g.rating : g.rating2})`;
}

/**
 * Полная подпись строки: имя, список специализаций, рейтинг.
 *
 * Годится и для одного предмета — `mergeAbilityItems([item])[0]`: так вкладка
 * «Развитие» показывает, ЗА КАКУЮ специализацию заплачено, оставляя строки
 * раздельными.
 */
export function abilityLabel(group) {
  const parts = [group?.baseName || ""];
  if (group?.specs?.length) parts.push(`(${group.specs.join(", ")})`);
  if (group?.ratingText)    parts.push(group.ratingText);
  return parts.filter(Boolean).join(" ");
}

/**
 * Сводка старых авто-эффектов по всей строке.
 *
 * Складывается так же, как считает актор (documents/actor.mjs): бонусы
 * характеристик, броня, Размер и Инициатива суммой, Страх — максимумом.
 * Иначе подпись строки разошлась бы с числами на листе.
 */
export function mergeAbilityEffects(items = []) {
  const out = { charBonus: {}, armourAll: 0, fearRating: 0, sizeMod: 0, initMod: 0 };

  for (const item of items) {
    const e = item?.system?.effects ?? {};
    if (e.charBonusStat && (e.charBonusValue || 0) !== 0)
      out.charBonus[e.charBonusStat] = (out.charBonus[e.charBonusStat] || 0) + e.charBonusValue;
    for (const cb of (Array.isArray(e.charBonuses) ? e.charBonuses : []))
      if (cb?.stat && (cb.value || 0) !== 0)
        out.charBonus[cb.stat] = (out.charBonus[cb.stat] || 0) + cb.value;
    out.armourAll  += Number(e.armourAll) || 0;
    out.sizeMod    += Number(e.sizeMod)   || 0;
    out.initMod    += Number(e.initMod)   || 0;
    out.fearRating  = Math.max(out.fearRating, Number(e.fearRating) || 0);
  }

  return out;
}

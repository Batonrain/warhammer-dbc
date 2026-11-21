// module/rules/flesh-sculptor-talents.mjs
// ════════════════════════════════════════════════════════════════════════
//  Скульптор Плоти — чистая арифметика Ритуала Лепки Плоти и его ветвей.
//  Кнопки и запись на акторов — combat/flesh-sculptor.mjs.
//
//  • Ритуал Лепки Плоти: Medicae−10 (+20 подопытный в сознании и не
//    доброволец, +10 за каждого близкого среди доноров; +Cor.b×5 на
//    Скульптурите). Успех — Успехи теста + 1d5 за донора (до 6), они
//    раздаются на Трейты списка (1 Успех — Трейт или +1 к рейтингу, рейтинг
//    до 6). Повторный ритуал — итог не хуже прежнего; Аполион — прибавляет.
//    Провал — R Критический Эффект 1d10−2+Провалы в торс, прежние Трейты
//    ритуала пропадают (Аполион — подопытный умирает).
//  • Хранение — метка fleshmold на подопытном: { successes, sculptor };
//    выданные Трейты несут метку fleshmoldGrant (постоянные) или
//    fleshmoldTemp (Безумно Податливый, временные).
//  • Безумно Податливый: Очко Бесчестия (или Плоть Эйдолона) + Medicae−10 →
//    временные Успехи на себя; раз в час W+0, Провалы снимают Успехи.
//  • Нарцисс: ритуал на себе — постоянный запас для Безумно Податливого.
//  • Эйдолон: пул «Плоть» (Cor.b×2), +T.b жертвы, 1 Плоть = 1 Рана.
//  • Скульптурит: Sycophant и Monodevotant, +Cor.b×5 к Medicae на нём.
// ════════════════════════════════════════════════════════════════════════

import { hasItemNamed } from "./req-atom.mjs";

export const FLESHMOLD_FLAG = "fleshmold";
export const FLESHMOLD_GRANT_FLAG = "fleshmoldGrant";
export const FLESHMOLD_TEMP_FLAG = "fleshmoldTemp";
export const MALLEABLE_FLAG = "malleable";
export const SCULPTURITE_FLAG = "sculpturiteOf";
export const FLESH_POOL = "flesh";
export const FLESHMOLD_RATING_MAX = 6;
export const FLESHMOLD_DONORS_MAX = 6;

export const hasRiteOfFleshmolding = a => hasItemNamed(a, "Rite of Fleshmolding", ["trait"]);
export const hasInsanelyMalleable = a => hasItemNamed(a, "Insanely Malleable", ["trait"]);
export const hasAppolyon = a => hasItemNamed(a, "Appolyon", ["talent"]);
export const hasEidolon = a => hasItemNamed(a, "Eidolon", ["talent"]);
export const hasNarcissus = a => hasItemNamed(a, "Narcissus", ["talent"]);
export const hasSculpturite = a => hasItemNamed(a, "Sculpturite", ["talent"]);

/**
 * Трейты ритуала (список книги). id — Трейт компендиума traits.
 * rated — у Трейта есть рейтинг (X), его можно поднимать до 6.
 * Unnatural Characteristic — по ключу на Характеристику.
 */
export const FLESHMOLD_TRAITS = [
  { key: "amphibious", name: "Amphibious", label: "Amphibious / Амфибия", id: "AE4vEU0dsm1gU2UA", rated: false },
  { key: "burrower", name: "Burrower", label: "Burrower (X) / Бурильщик", id: "AtusicBXFwcncAmM", rated: true },
  { key: "crawler", name: "Crawler", label: "Crawler / Ползун", id: "3IUpInrP6u5gL52W", rated: false },
  { key: "dnw", name: "Deadly Natural Weapons", label: "Deadly Natural Weapons (X) / Смертельное Естественное Оружие", id: "izr4BASd4MVkw3Cm", rated: true },
  { key: "flyer", name: "Flyer", label: "Flyer (X) / Летун", id: "6PG9FuSMS13O6Ou8", rated: true },
  { key: "arms", name: "Multiple Arms", label: "Multiple Arms (+X) / Многорукий", id: "b2B8zxbhoK961wEf", rated: true },
  { key: "armour", name: "Natural Armour", label: "Natural Armour (X) / Естественная Броня", id: "bvO8S59a6fOSBXcK", rated: true },
  { key: "quadruped", name: "Quadruped", label: "Quadruped (X) / Четвероногий", id: "31D26GZsnxBNJO5n", rated: true },
  { key: "sturdy", name: "Sturdy", label: "Sturdy / Надёжный", id: "ZPrppKroO0nNHfMf", rated: false },
  ...["ws", "bs", "s", "t", "ag", "int", "per", "wp", "fel"].map(c => ({
    key: `uc:${c}`, name: "Unnatural Characteristic", label: `Unnatural Characteristic (${c.toUpperCase()}) (X)`,
    id: "4qpNsaAyspuyAqPV", rated: true, charKey: c
  })),
  { key: "senses", name: "Unnatural Senses", label: "Unnatural Senses (X) / Сверхъестественные Чувства", id: "7x1jLzfRKXuA0vew", rated: true }
];

/** Поправка теста ритуала. */
export function fleshmoldModifier({ unwilling = false, friends = 0, sculpturiteBonus = 0 } = {}) {
  return -10 + (unwilling ? 20 : 0) + 10 * Math.max(0, Math.trunc(Number(friends) || 0))
    + Math.max(0, Number(sculpturiteBonus) || 0);
}

/** Бонус Скульптурита: +Cor.b×5 к Medicae на своём Скульптурите. */
export function sculpturiteMedicaeBonus(sculptor, subject) {
  if (!hasSculpturite(sculptor) || !subject) return 0;
  const f = subject?.flags?.["warhammer-dbc"]?.[SCULPTURITE_FLAG] ?? subject?.getFlag?.("warhammer-dbc", SCULPTURITE_FLAG);
  if (!f || f !== sculptor?.uuid) return 0;
  return 5 * Math.max(0, Number(sculptor?.system?.corruptionBonus) || 0);
}

/** Сколько доноров даёт по 1d5 Успехов (не больше 6). */
export function donorDice(donors) {
  return Math.max(0, Math.min(FLESHMOLD_DONORS_MAX, Math.trunc(Number(donors) || 0)));
}

/** Итог Успехов подопытного: повторный ритуал — не хуже прежнего, Аполион — сумма. */
export function fleshmoldTotal({ prev = 0, gained = 0, appolyon = false } = {}) {
  const p = Math.max(0, Number(prev) || 0);
  const g = Math.max(0, Number(gained) || 0);
  return appolyon ? p + g : Math.max(p, g);
}

/** Провал ритуала: формула R Критического Эффекта в торс. */
export function fleshmoldCritFormula(failDeg) {
  return `1d10-2+${Math.max(0, Math.trunc(Number(failDeg) || 0))}`;
}

/** Уровень Критического Эффекта из броска (не ниже 1, не выше 10). */
export function fleshmoldCritLevel(total) {
  return Math.max(1, Math.min(10, Math.trunc(Number(total) || 0)));
}

/** Цена раскладки: { key: рейтинг } → Успехов. Безрейтинговый Трейт стоит 1. */
export function fleshmoldPlanCost(plan = {}) {
  let cost = 0;
  for (const t of FLESHMOLD_TRAITS) {
    const v = Math.max(0, Math.trunc(Number(plan[t.key]) || 0));
    if (!v) continue;
    cost += t.rated ? Math.min(FLESHMOLD_RATING_MAX, v) : 1;
  }
  return cost;
}

/** Проверка раскладки: не дороже запаса, рейтинги 1..6. */
export function fleshmoldPlanCheck(plan, successes) {
  for (const t of FLESHMOLD_TRAITS) {
    const v = Number(plan?.[t.key]) || 0;
    if (t.rated && v > FLESHMOLD_RATING_MAX) return { ok: false, reason: `${t.label}: рейтинг не выше ${FLESHMOLD_RATING_MAX}.` };
  }
  const cost = fleshmoldPlanCost(plan);
  if (cost > successes) return { ok: false, cost, reason: `Раскладка стоит ${cost} Успехов, а есть ${successes}.` };
  return { ok: true, cost, reason: "" };
}

/**
 * Безумно Податливый, часовой тест W+0: Провалы снимают временные Успехи.
 * «Как если бы Успехов стало меньше на число Провалов».
 */
export function malleableAfterHour(tempSuccesses, { success, deg }) {
  const s = Math.max(0, Number(tempSuccesses) || 0);
  return success ? s : Math.max(0, s - Math.max(1, Number(deg) || 1));
}

/**
 * Какие временные Трейты снять, чтобы раскладка уложилась в запас: снимаются
 * с конца списка (последние добавленные). grants — [{ key, rating }].
 * @returns {{keep: object[], drop: object[]}}
 */
export function trimGrantsToBudget(grants, budget) {
  const keep = [...(grants ?? [])];
  const drop = [];
  const costOf = list => list.reduce((s, g) => s + (FLESHMOLD_TRAITS.find(t => t.key === g.key)?.rated ? Number(g.rating) || 1 : 1), 0);
  while (keep.length && costOf(keep) > budget) drop.unshift(keep.pop());
  return { keep, drop };
}

/** Эйдолон: максимум Плоти Cor.b×2 (запись resourcePool), прибыль — T.b жертвы. */
export function eidolonGain(victimToughnessBonus) {
  return Math.max(0, Math.trunc(Number(victimToughnessBonus) || 0));
}

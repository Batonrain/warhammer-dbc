// module/rules/vacuum.mjs
// ════════════════════════════════════════════════════════════════════════════
//  ВАКУУМ (корбук, «Опасности», стр. 483, Sahara trade-voidfarer-10-wdbc-dbveg).
//
//  «Персонаж, начинающий свой Ход в вакууме, и не защищённый пустотной броней,
//  должен пройти тест Т+0, или получить Провалы непоглощаемого X Dmg в торс…
//  Если он задерживает дыхание, персонаж получает штраф –30 на этот тест и ещё
//  +1d5 урона при провале. Если глаза не закрыты от вакуума, он в начале каждого
//  Хода получает попадание со свойством Blinding(0)… Персонаж может использовать
//  Trade (Voidfarer) (T)+10 вместо обычных тестов Т+0 против вакуума».
//  «Взрывная Декомпрессия: шаблон взрыва радиусом в 10 раз больше ширины
//  пробоя… 2d10 непоглощаемого X Dmg всем существам без пустотной брони».
//
//  Здесь — чистая часть без Foundry: кто защищён, Порог теста, урон за Провал,
//  радиус. Бросок, урон и карточки — module/combat/vacuum.mjs; флаг «сцена в
//  вакууме» — constants/environment.mjs; Преимущество Крепкого как Камень —
//  rules/squat-traits.mjs::vacuumResistReroll.
//
//  «Провалы» толкуются как степени провала теста (так книга зовёт степени в
//  других местах: «N Успехов»/«N Провалов») — по одному непоглощаемому урону за
//  степень. Это решение исполнителя при нечётком русском тексте, помечено в
//  отчёте задачи.
//
//  Файл читает только чистые модули (void-air.mjs, констант-таблицы): его нет
//  в графе sources.mjs и он не должен туда попадать (source-registry-acyclic).
// ════════════════════════════════════════════════════════════════════════════

import { wraithboneRegenIgnoresBreach } from "./void-air.mjs";
import { hasStuffOfNightmares } from "./stuff-of-nightmares.mjs";
import { findGroupEntry } from "../constants/skill-specializations.mjs";
import { GROUP_SKILLS_DEF } from "../constants/skills.mjs";

/** «Штраф –30 на этот тест» при задержке дыхания. */
export const VACUUM_BREATH_PENALTY = -30;
/** «Trade (Voidfarer) (T)+10 вместо обычных тестов Т+0». */
export const VOIDFARER_BONUS = 10;
/** «И ещё +1d5 урона при провале теста» при задержке дыхания. */
export const VACUUM_BREATH_FAIL_DIE = "1d5";
/** Урон Взрывной Декомпрессии. */
export const DECOMPRESSION_DAMAGE = "2d10";
/** Радиус Декомпрессии = 10 × ширина пробоя. */
export const DECOMPRESSION_RADIUS_FACTOR = 10;

/** Вакуум и Декомпрессия бьют существ, у которых есть T и Раны (миньоны и демоны — тоже: у них схема существа). */
const VACUUM_ACTOR_TYPES = new Set(["character", "daemon", "demonPrince", "minion"]);

/**
 * Надетая герметичная пустотная броня (свойство `void`). Пробитая броня теряет
 * герметичность сразу (rules/void-air.mjs), кроме Wraithbone Regeneration в
 * руках псайкера. Запас воздуха (6 часов) защиту от давления не снимает —
 * он про дыхание, а не про вакуум; следит за ним лист брони.
 * @returns {?object} предмет-броня или null
 */
export function voidArmourOf(actor) {
  for (const i of actor?.items ?? []) {
    if (i?.type !== "armor" || !i.system?.equipped) continue;
    if (!(i.system.properties ?? []).includes("void")) continue;
    if (i.system.breached && !wraithboneRegenIgnoresBreach(i)) continue;
    return i;
  }
  return null;
}

/** Накрыт ли актор Взрывной Декомпрессией: существо без пустотной брони. */
export function isDecompressionVictim(actor) {
  return !!actor && VACUUM_ACTOR_TYPES.has(actor.type) && !voidArmourOf(actor) && !hasStuffOfNightmares(actor);
}

/**
 * Вакуум сцены касается актора: существо без пустотной брони (Техника и
 * корабли — нет). Трейт Stuff of Nightmares даёт иммунитет к вакууму.
 */
export function vacuumApplies(actor) {
  return !!actor && VACUUM_ACTOR_TYPES.has(actor.type) && !voidArmourOf(actor) && !hasStuffOfNightmares(actor);
}

/**
 * Порог Trade (Voidfarer), пересчитанный на Стойкость: «(T)». Запись групповой
 * Навыки считает character.mjs (total = Хар-ка + ранг + мод), а здесь Хар-ка
 * записи (по умолчанию — Int группы Trade) заменяется на T: ранг и
 * постоянный модификатор остаются. Нетренированная запись даёт штраф ранга
 * (−20) — навык «изучен» не считаем, а честно возвращаем его цену.
 * @returns {?number} null — записи Voidfarer нет вовсе
 */
export function voidfarerBase(actor) {
  const entry = findGroupEntry(actor, "trade", "voidfarer");
  if (!entry) return null;
  const chars = actor?.system?.characteristics ?? {};
  const own = chars[entry.char || GROUP_SKILLS_DEF.trade?.char]?.total;
  const t = Number(chars.t?.total) || 0;
  return (Number(entry.total) || 0) - (Number(own) || 0) + t;
}

/**
 * План теста: на чём бросаем и какой Порог без модификаторов реестра правил.
 * Voidfarer(T)+10 берётся, только если он выгоднее обычного T+0 — книга даёт
 * право «использовать вместо», худший вариант брать незачем.
 * @param {object} actor
 * @param {{holdBreath?:boolean}} [o]
 * @returns {{base:number, mod:number, skill:"T"|"Voidfarer", parts:string[], threshold:number}}
 */
export function vacuumTestPlan(actor, { holdBreath = false } = {}) {
  const t = Number(actor?.system?.characteristics?.t?.total) || 0;
  const vf = voidfarerBase(actor);
  const useVoidfarer = vf != null && vf + VOIDFARER_BONUS > t;
  const base = useVoidfarer ? vf : t;
  let mod = useVoidfarer ? VOIDFARER_BONUS : 0;
  const parts = useVoidfarer ? ["Trade (Voidfarer) (T) +10"] : [];
  if (holdBreath) {
    mod += VACUUM_BREATH_PENALTY;
    parts.push("задержка дыхания −30");
  }
  return { base, mod, skill: useVoidfarer ? "Voidfarer" : "T", parts, threshold: base + mod };
}

/**
 * Урон за проваленный тест: по единице за степень провала; при задержке
 * дыхания — ещё значение кубика +1d5 (его катает вызывающий).
 * @returns {{amount:number, breath:number}}
 */
export function vacuumDamage(degrees, { holdBreath = false, breathRoll = 0 } = {}) {
  const base = Math.max(0, Math.floor(Number(degrees) || 0));
  const breath = holdBreath ? Math.max(0, Math.floor(Number(breathRoll) || 0)) : 0;
  return { amount: base + breath, breath };
}

/** Радиус Декомпрессии, метры: 10 × ширина пробоя (0 — ширины нет). */
export function decompressionRadius(width) {
  const w = Number(width);
  return Number.isFinite(w) && w > 0 ? w * DECOMPRESSION_RADIUS_FACTOR : 0;
}

// module/rules/throwing-talents.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Таланты Метания (глава 3, группа «Метание»). Сейчас здесь один — Балеарец.
//
//  Balearic / Балеарец (A 50, Athletics+10) [книга]: «Он добавляет ½A.b (окр.▲)
//  к S.b в расчёте дальности и урона метательного и примитивного стрелкового
//  оружия.»
//
//  Сделан УРОН метательного оружия (класс «thrown» — единственный стрелковый
//  класс, который в системе получает S.b к урону, combat/attack.mjs). Дальность
//  (S.b×3 м) и «примитивное стрелковое» остаются за столом: у примитивного
//  стрелкового S.b в расчёте урона нет вовсе, добавлять не к чему (3-8318).
//
//  Чистая логика без Foundry; ability-by-key.mjs — единственная зависимость.
// ════════════════════════════════════════════════════════════════════════════

import { hasAbility, hasTalentCapability } from "./ability-by-key.mjs";

/** Возможность, которую выдаёт Талант «Балеарец» (запись Конструктора в паке). */
export const BALEARIC_CAPABILITY = "throwing.core.balearic";

/**
 * Прибавка к S.b метательного оружия: ½A.b вверх. 0 — Таланта нет.
 * @param {object} actor
 * @param {number} [agilityBonus] A.b; по умолчанию с листа актора
 */
export function balearicSbBonus(actor, agilityBonus = actor?.system?.characteristics?.ag?.bonus) {
  if (!hasTalentCapability(actor, BALEARIC_CAPABILITY)) return 0;
  const ab = Number(agilityBonus) || 0;
  return ab > 0 ? Math.ceil(ab / 2) : 0;
}

// ── Гренадер ────────────────────────────────────────────────────────────────

export const GRENADIER = Object.freeze({ key: "throwing.core.grenadier", name: "Grenadier" });

/**
 * Гренадер (core.json, «Метание», Sahara 3-8318): «Если брошенная им граната
 * промахнулась, он может уменьшить дистанцию смещения на BS.b. Если после этого
 * взрыв не задевает ни одного врага, или задевает союзные цели, персонаж может
 * перебросить направление смещения».
 *
 * Здесь — только «чей это бросок и на сколько можно уменьшить»: BS.b для броска
 * гранаты стрелковым оружием-гранатой, иначе 0. Сами кнопки — на карточке атаки
 * (смещение бывает только у Взрывного «под цель», attack.mjs); «не задел врагов /
 * задел союзников» решает стол — в системе у смещённого взрыва нет списка накрытых.
 * Не моделируется: «не получает штрафов на попадание при броске рикошетом»
 * (рикошета броска гранаты в системе нет).
 */
export function grenadierScatterReduce(actor, { sys, isMelee, bsBonus }) {
  if (isMelee || sys?.weaponType !== "grenade") return 0;
  if (!hasAbility(actor, GRENADIER.key, GRENADIER.name, "talent")) return 0;
  return Math.max(0, Number(bsBonus) || 0);
}

/** Дистанция смещения после уменьшения (не ниже 0). */
export const reducedScatterDistance = (distance, reduce) => Math.max(0, (Number(distance) || 0) - (Number(reduce) || 0));

// ── Поколотить ──────────────────────────────────────────────────────────────

export const CLOBBER_CAPABILITY = "throwing.core.clobber";
export const hasClobber = actor => hasAbility(actor, CLOBBER_CAPABILITY, "Clobber", "talent");

/**
 * Поколотить / Clobber (core.json, «Метание», Sahara 3-8318): «Когда он попадёт по цели метательным
 * оружием (в т.ч. импровизированным), весящим как минимум ¼ от цели, цель должна пройти тест S+0, или ее
 * сбивает с ног. Если снаряд весит хотя бы ½ от цели, та получает штраф −10 на этот тест, а если снаряд
 * весит больше цели — штраф −20».
 *
 * Допущение исполнителя: «вес цели» — полный вес персонажа (тело, Записи → Вес, плюс носимое снаряжение,
 * improvised-weapon.mjs::totalWeightOf) — так система уже считает персонажа как снаряд. Вес снаряда — вес
 * предмета-оружия (system.weight). Не заполнен любой из двух — сравнить нельзя, решает стол.
 *
 * @param {number} projectileKg  вес снаряда, кг
 * @param {number} targetKg      вес цели, кг
 * @returns {{status: "ok"|"tooLight"|"noProjectileWeight"|"noTargetWeight", mod?: number, ratio?: number}}
 *   mod — штраф S-теста цели (0 / −10 / −20)
 */
export function clobberPlan(projectileKg, targetKg) {
  const p = Number(projectileKg) || 0;
  const t = Number(targetKg) || 0;
  if (!(p > 0)) return { status: "noProjectileWeight" };
  if (!(t > 0)) return { status: "noTargetWeight" };
  const ratio = p / t;
  if (ratio < 0.25) return { status: "tooLight", ratio };
  return { status: "ok", ratio, mod: ratio > 1 ? -20 : ratio >= 0.5 ? -10 : 0 };
}

// ── Залповый Бросок ─────────────────────────────────────────────────────────

export const VOLLEY_THROW_CAPABILITY = "throwing.core.volleyThrow";
export const hasVolleyThrow = actor => hasAbility(actor, VOLLEY_THROW_CAPABILITY, "Volley Throw", "talent");

/** RoF залпа — «от 2 до 4 по выбору» (вариант «<кол. пальцев>−1» для нечеловеческой руки в системе не ведётся). */
export const VOLLEY_ROF_MIN = 2;
export const VOLLEY_ROF_MAX = 4;
/** «Сходное по размеру» с ножом и флешеттой: до 0,3 кг (метательный нож 0,2 кг; допущение исполнителя — книга размера не мерит). */
export const VOLLEY_MAX_WEIGHT_KG = 0.3;
const VOLLEY_EXCLUDED_TYPES = new Set(["grenade", "explosive", "rocket", "exotic"]);

/**
 * Залповый Бросок / Volley Throw (core.json, «Метание», Sahara 3-8318): «Он может использовать метательные ножи,
 * флешеты и сходное по размеру метательное оружие в режиме длинной очереди с модификатором +0 вместо обычного −10
 * и RoF от 2 до 4 (или <кол. пальцев>−1, если у него на руке не 5 пальцев) по выбору персонажа. Эта атака не
 * получает бонусы от Прицеливания».
 *
 * Применимо ли к оружию: класс «Метательное», не граната/бомба/ракета/экзотика, лёгкое (вес не больше
 * VOLLEY_MAX_WEIGHT_KG либо не заполнен) и бросаемое по одному (иначе оно не метательное в обычном смысле).
 * @param {object} actor
 * @param {object} sys  system оружия
 */
export function volleyThrowApplies(actor, sys) {
  if (!sys || sys.weaponClass !== "thrown") return false;
  if (VOLLEY_EXCLUDED_TYPES.has(sys.weaponType)) return false;
  if (!((Number(sys.rof_single) || 0) > 0)) return false;
  const w = Number(sys.weight) || 0;
  if (w > VOLLEY_MAX_WEIGHT_KG) return false;
  return hasVolleyThrow(actor);
}

/** RoF залпа из поля окна: 2..4; пусто или 0 — потолок (как у Быстрого Курка). */
export function volleyRof(raw) {
  const n = Math.trunc(Number(raw)) || 0;
  if (n <= 0) return VOLLEY_ROF_MAX;
  return Math.min(VOLLEY_ROF_MAX, Math.max(VOLLEY_ROF_MIN, n));
}

// ── Выдержка Гранаты ────────────────────────────────────────────────────────

export const GRENADE_COOKING_CAPABILITY = "throwing.core.grenadeCooking";
export const hasGrenadeCooking = actor => hasAbility(actor, GRENADE_COOKING_CAPABILITY, "Grenade Cooking", "talent");

/**
 * Выдержка Гранаты / Grenade Cooking (core.json, «Метание», Sahara 3-8318): «Перед броском гранаты персонаж может пройти
 * тест Logic(I)+0. При Успехе тесты Уклонения от гранаты получают штраф −5×Успехи. При Провале граната получает свойство
 * Very Unreliable и её всё равно нужно метнуть».
 *
 * Предлагается ли галочка и срабатывает ли тест: у носителя Таланта, граната (weaponType "grenade") бросается
 * (не рукопашное применение), галочка в окне атаки включена.
 */
export function grenadeCookingApplies(actor, { sys, isMelee = false, toggles = {} } = {}) {
  if (isMelee || sys?.weaponClass !== "thrown" || sys?.weaponType !== "grenade") return false;
  return !!toggles?.grenadeCooking && hasGrenadeCooking(actor);
}

/** Галочка видна в окне атаки: носитель Таланта и граната, брошенная не в рукопашной. */
export function grenadeCookingOffered(actor, { sys, isMelee = false } = {}) {
  return !isMelee && sys?.weaponClass === "thrown" && sys?.weaponType === "grenade" && hasGrenadeCooking(actor);
}

/** Штраф Уклонения от гранаты: −5 за каждый Успех теста Logic(I)+0; Провал и непройденный тест — 0. */
export const grenadeCookingDodgePenalty = result => (result?.success ? -5 * Math.max(0, Number(result.deg) || 0) : 0);

// ── Бросок на Бегу ──────────────────────────────────────────────────────────

export const RUNNING_THROW_CAPABILITY = "throwing.core.runningThrow";
export const hasRunningThrow = actor => hasAbility(actor, RUNNING_THROW_CAPABILITY, "Running Throw", "talent");

/** Тест Acrobatics−10 в этом Ходу уже проходили — «раз в Ход» (turn-scoped, rules/turn-flags.mjs). */
export const RUNNING_THROW_USED_FLAG = "runningThrowUsed";
/** Тест удался, свободный бросок ещё не сделан (turn-scoped). */
export const RUNNING_THROW_PENDING_FLAG = "runningThrowPending";
/** Модификатор теста Acrobatics. */
export const RUNNING_THROW_ACROBATICS_MOD = -10;

/**
 * Бросок на Бегу / Running Throw (core.json, «Метание», Sahara 3-8318): «Раз в Ход, совершая любое Движение, он может
 * пройти тест на Acrobatics–10, чтобы совершить дополнительную атаку метательным оружием или гранатой (но не бомбой)
 * как свободное действие. Это уменьшает Rng оружия до S.b×2м и не считается атакой в расчете действий».
 *
 * Допущения исполнителя: «раз в Ход» тратится самой попыткой (тест пройден — успешно или нет); «бомба» — оружие с
 * weaponType "explosive" (все бомбы пака); «любое Движение» — первое Движение Хода в бою, действие Движения или
 * перемещение токена (флаг movedThisTurn, combat/movement-actions.mjs::markMovedThisTurn).
 */
export function runningThrowEligibleWeapon(item) {
  const sys = item?.system;
  if (item?.type !== "weapon" || sys?.weaponClass !== "thrown" || sys?.weaponType === "explosive") return false;
  // Гранаты в паке без одиночного режима (rof_single 0) — их бросок не зависит от RoF, окно атаки обходится без режимов.
  return sys?.weaponType === "grenade" || (Number(sys?.rof_single) || 0) > 0;
}

/** Rng свободного броска: S.b×2 м (обычно S.b×3). */
export const runningThrowRange = sBonus => 2 * Math.max(0, Number(sBonus) || 0);

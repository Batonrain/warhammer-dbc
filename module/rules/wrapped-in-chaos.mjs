// module/rules/wrapped-in-chaos.mjs
// ════════════════════════════════════════════════════════════════════════
//  Wrapped in Chaos/Укутанный в Хаос (Общие Мутации, wdbc-1rno) — 10
//  субмутаций (rules/submutations.mjs), у каждой свой эффект дыма/Порчи.
//
//  Группа A (готовые примитивы, реализована здесь): "4-5" Дымовая Завеса
//  (шаблон Smoke(5) на себе — тот же примитив, что уже даёт Fruit of Flesh/
//  Плод Плоти), "7" Мухи (штраф атакующим по зрению, растёт по тиру Ран
//  цели — реализована в module/sheets/attack-dialog.mjs, тем же приёмом,
//  что уже даёт Цель Повалена/Оглушена: статический badge от условия
//  цели, не отдельная запись Конструктора), "1" Тень, "6" Сладкий Туман,
//  "9" Рассечение Реальности, "10" Осквернённый Клинок — все реализованы,
//  детали каждой в capabilities.mjs (mutation.wrappedInChaos).
//
//  "2-3" Фантомные Копии — ПЕРЕОЦЕНЕНА: изначально числилась архитектурно
//  блокированной («нет направленного модификатора атакующий↔защитник для
//  Защиты»), но module/combat/defense.mjs уже резолвит attackerUuid в
//  attackerActor ДО построения профиля теста (тот же путь, что даёт Длань
//  Кхорна Парированию) — штраф Уклонению (phantomCopiesDodgePenalty) и
//  бонус Финту (phantomCopiesFeintBonus) реализованы этим путём. Бонус к
//  Вольтам — честный блок: "Вольт" не отдельный бросок с порогом
//  (module/combat/recoil.mjs — флаг ПОСЛЕ уже состоявшегося Уклонения),
//  нет к чему прибавлять число.
//
//  "8" Жар Гнева — штраф атакующему (wrathHeatAttackPenalty) реализован
//  тем же приёмом, что "Мухи"; гейт книги «в Ярости ИЛИ связан рукопашной»
//  сведён к «действует всегда при самой рукопашной атаке» (решение
//  пользователя). Плавка краски/испарение жидкостей в радиусе 1м —
//  косметика, не автоматизирована.
// ════════════════════════════════════════════════════════════════════════

import { itemIs } from "./item-marker.mjs";

const NAME = "Wrapped in Chaos";

/** Это предмет-Мутация «Укутанный в Хаос»? */
export function isWrappedInChaosItem(item) {
  return itemIs(item, "mutation", "mutation.wrappedInChaos", NAME);
}

const KIND_BY_LABEL = {
  "1": "shadow", "2-3": "phantomCopies", "4-5": "smokeScreen", "6": "sweetMist",
  "7": "flies", "8": "wrathHeat", "9": "realityRending", "10": "taintedBlade"
};

/** Вид эффекта по подписи субмутации — "" если субмутация ещё не выпала/не распознана. */
export function wrappedInChaosKindByLabel(label) {
  return KIND_BY_LABEL[String(label ?? "").trim()] || "";
}

// "Мухи" (субмутация "7"): штраф атакующим, зависящим от зрения, растёт по
// тиру Ран цели. Базовый штраф книга даёт числом (−5/−10 Избирательная),
// дальше — табличная прогрессия по тиру. Ключи — displayKey из rules/
// wound-tier.mjs::woundLevel (healthy/light/heavy/dying — "critical" книги
// это displayKey "dying" в этой системе, не самостоятельный ключ).
const FLIES_TABLE = {
  healthy: { normal: -5,  aimed: -10 },
  light:   { normal: -10, aimed: -20 },
  heavy:   { normal: -15, aimed: -30 },
  dying:   { normal: -20, aimed: -40 }
};

/** Штраф атакующему от "Мух" — woundTier: система тиров Ран цели (predicates.mjs). */
export function fliesAttackPenalty(woundTier, aimed = false) {
  const row = FLIES_TABLE[woundTier] || FLIES_TABLE.healthy;
  return aimed ? row.aimed : row.normal;
}

/** У цели активна субмутация "7" Мухи — Укутанный в Хаос с этим конкретным исходом. */
export function targetHasActiveFlies(targetActor) {
  return [...(targetActor?.items ?? [])].some(it =>
    isWrappedInChaosItem(it) && wrappedInChaosKindByLabel(it.system?.submutation?.label) === "flies");
}

// "10" Осквернённый Клинок: 1 непоглощ. урона себе → своему клинку Tainted
// на 12 Раундов. Округлено до «до конца боя» (тот же приём, что уже даёт
// Blood Flame/Кровавое Пламя, combat/blood-flame.mjs) — точного счётчика
// раундов для временных weaponProp-грантов в системе нет ни у одной
// находки; честно отмечено в capabilities.mjs, не выдаётся за 12 Раундов.
export const TAINTED_BLADE_ADDED_FLAG = "wrappedInChaosTaintedAdded";

// "9" Рассечение Реальности: +3 ко ВСЕМУ входящему урону всем в радиусе 3м
// владельца (кроме владельца), кроме исключённых до W.b союзников. НОВЫЙ
// источник плоской поправки к входящему урону — читается ЖИВЬЁМ в момент
// урона (combat/damage.mjs, wdbc-bjy1.3), не запекается в
// system.incomingDamageReduction: зависит от позиций токенов, а движение
// соседа пересчёта цели не вызывает. Ничего не хранится на цели, только на
// владельце — исключения. Знак: отрицательное значение = МЕНЬШЕ поглощения
// = БОЛЬШЕ входящего урона (тот же знак, что у incomingDamageReduction).
const REALITY_RENDING_RADIUS_M = 3;
const REALITY_RENDING_PENALTY = -3;
export const REALITY_RENDING_EXCLUDED_FLAG = "realityRendingExcluded";

function isRealityRendingItem(it) {
  return isWrappedInChaosItem(it) && wrappedInChaosKindByLabel(it.system?.submutation?.label) === "realityRending";
}

/**
 * Дистанция между двумя TokenDocument (центр-к-центру, с учётом высоты) —
 * ТА ЖЕ формула, что module/regions/auras.mjs::tokenDocDistance, продублирована
 * НЕ импортом: тот модуль тянет apps/mechanics.mjs → regions/difficult-
 * terrain.mjs, чей класс на верхнем уровне объявлен как `extends foundry.
 * data.regionBehaviors.RegionBehaviorType` — требует глобальный `foundry`
 * уже на этапе импорта. rules/wrapped-in-chaos.mjs (как и rules/psychic-
 * sustain-target.mjs, чистый без единого импорта) обязан работать в чистых
 * юнит-тестах без единого Foundry-стаба — импорт того модуля сломал бы это
 * для character.mjs (который сам зовётся на голых объектах в части тестов).
 */
function tokenDocDistance(a, b, grid) {
  const size = Number(grid?.size) || 100;
  const unit = Number(grid?.distance) || 1;
  const ax = a.x + (a.width * size) / 2, ay = a.y + (a.height * size) / 2;
  const bx = b.x + (b.width * size) / 2, by = b.y + (b.height * size) / 2;
  const flat = Math.hypot(ax - bx, ay - by) / size * unit;
  const dz = (Number(a.elevation) || 0) - (Number(b.elevation) || 0);
  return Math.hypot(flat, dz);
}

/** Вклад "Рассечения Реальности" в system.incomingDamageReduction ЭТОГО актора (сумма от всех источников в радиусе). */
export function realityRendingPenalty(actor) {
  if (typeof game === "undefined" || !actor?.uuid) return 0;
  const myToken = actor.getActiveTokens?.(false, true)?.[0];
  if (!myToken?.parent) return 0;

  let penalty = 0;
  for (const owner of game.actors ?? []) {
    if (!owner || owner.uuid === actor.uuid) continue;
    const source = [...(owner.items ?? [])].find(isRealityRendingItem);
    if (!source) continue;
    // «До W.b союзников» — жёсткий предел книги, не «сколько выбрано»:
    // лишние выбранные сверх W.b просто не считаются (первые по порядку).
    const wpBonus = Number(owner.system?.characteristics?.wp?.bonus) || 0;
    const excluded = (source.getFlag?.("warhammer-dbc", REALITY_RENDING_EXCLUDED_FLAG) || []).slice(0, wpBonus);
    if (excluded.includes(actor.uuid)) continue;
    const ownerToken = owner.getActiveTokens?.(false, true)?.[0];
    if (!ownerToken || ownerToken.parent !== myToken.parent) continue;
    if (tokenDocDistance(myToken, ownerToken, myToken.parent.grid) <= REALITY_RENDING_RADIUS_M) {
      penalty += REALITY_RENDING_PENALTY;
    }
  }
  return penalty;
}

// "2-3" Фантомные Копии: направленный модификатор атакующий→защитник, тем
// же приёмом, что уже читает module/combat/defense.mjs для Разницы Размеров
// (attackerUuid резолвится в attackerActor ДО построения профиля теста) —
// не новый примитив, а перенос уже существующего пути на защиту.
function isPhantomCopiesItem(it) {
  return isWrappedInChaosItem(it) && wrappedInChaosKindByLabel(it.system?.submutation?.label) === "phantomCopies";
}

/** У actor'а выпала субмутация "2-3" Фантомные Копии. */
export function hasPhantomCopies(actor) {
  return [...(actor?.items ?? [])].some(isPhantomCopiesItem);
}

const PHANTOM_COPIES_DODGE_PENALTY = -10;
const PHANTOM_COPIES_FEINT_BONUS = 20;

/** Штраф Уклонению защитника от рукопашной атаки владельца "2-3" — вызывается со стороны атакующего (attackerActor), не защитника. */
export function phantomCopiesDodgePenalty(attackerActor, isMelee = true) {
  return isMelee && hasPhantomCopies(attackerActor) ? PHANTOM_COPIES_DODGE_PENALTY : 0;
}

/** Бонус к тестам Финта владельцу "2-3" (module/combat/techniques.mjs — гейт по имени техники, как у Танца Обмана). */
export function phantomCopiesFeintBonus(actor) {
  return hasPhantomCopies(actor) ? PHANTOM_COPIES_FEINT_BONUS : 0;
}

// "8" Жар Гнева (половина): направленный модификатор атакующий→защитник в
// ДРУГУЮ сторону — штраф самому АТАКУЮЩЕМУ, читается с позиции цели, тот же
// приём, что уже даёт "Мухи" (module/sheets/attack-dialog.mjs). Гейт книги
// «в Ярости ИЛИ связан рукопашной» реализован как «действует всегда при
// самой рукопашной атаке» (решение пользователя, wdbc-1rno) — «связан
// рукопашной» тавтологично верно в момент, когда эта атака уже происходит;
// не введено отдельное чтение Состояния inRage, чтобы не задваивать условие.
function isWrathHeatItem(it) {
  return isWrappedInChaosItem(it) && wrappedInChaosKindByLabel(it.system?.submutation?.label) === "wrathHeat";
}

const WRATH_HEAT_RADIUS_M = 3;
const WRATH_HEAT_ATTACK_PENALTY = -10;

/** Штраф атакующему на рукопашную атаку против targetActor — сам держит "8", либо держатель в радиусе 3м от него. */
export function wrathHeatAttackPenalty(targetActor, isMelee = true) {
  if (!isMelee || !targetActor) return 0;
  if ([...(targetActor.items ?? [])].some(isWrathHeatItem)) return WRATH_HEAT_ATTACK_PENALTY;
  if (typeof game === "undefined") return 0;
  const targetToken = targetActor.getActiveTokens?.(false, true)?.[0];
  if (!targetToken?.parent) return 0;
  for (const holder of game.actors ?? []) {
    if (!holder || holder.uuid === targetActor.uuid) continue;
    if (![...(holder.items ?? [])].some(isWrathHeatItem)) continue;
    const holderToken = holder.getActiveTokens?.(false, true)?.[0];
    if (!holderToken || holderToken.parent !== targetToken.parent) continue;
    if (tokenDocDistance(targetToken, holderToken, targetToken.parent.grid) <= WRATH_HEAT_RADIUS_M) {
      return WRATH_HEAT_ATTACK_PENALTY;
    }
  }
  return 0;
}

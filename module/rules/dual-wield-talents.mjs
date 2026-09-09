// module/rules/dual-wield-talents.mjs
// ════════════════════════════════════════════════════════════════════════════
//  ВЕТКА «ДВА ОРУЖИЯ» ЗА ПРЕДЕЛАМИ ПАРНОГО ШТРАФА (wdbc-pb60).
//
//  module/rules/dual-wield.mjs считает ОДНО: сколько стоит бить двумя руками —
//  штраф −20, скидки к нему, одно действие на пару. Шесть Талантов ветки дают
//  не скидку, а своё правило в другом месте конвейера, и до этого модуля все
//  шесть стояли в реестре возможностей с пустым reader: игрок читал их текст и
//  держал эффект в голове.
//
//  Здесь только условия и числа — чистые функции без Foundry и без интерфейса.
//  Кто зовёт и куда подключено («Огонь из Всех Орудий» ещё не подключён — ему
//  нужен режим огня второй руки в окне атаки, которого пока нет: вторая рука
//  всегда стреляет одиночным; остался в wdbc-pb60):
//
//   • Крестовой Блок — module/combat/defense.mjs: parryProfile суммирует бонусы
//     Парирования ОБОИХ оружий, _performParry прячет кнопку Контратаки.
//   • Мэн-Гош — module/combat/defense.mjs::_performParry (переброс теста
//     Парирования ножом, которым не били в прошлый Ход).
//   • Молотильщик — module/combat/attack.mjs + attack-card.mjs (примечание
//     защищающемуся: успешное Парирование сжигает Успехи и требует второго
//     теста — «неиспользованных Успехов защиты» система не хранит, обнулять
//     нечего, поэтому строка столу, а не расчёт).
//   • Дикарь — module/combat/attack.mjs (+2 Успеха к степени удачной атаки
//     парными когтями).
//   • Винтовочная Гарда — module/combat/attack.mjs (цель НЕ получает +30/+10
//     на Уклонение от выстрела в рукопашной).
//
//  ── Почему проверка «чем вооружён» живёт здесь, а не в каждом месте ────────
//  Все шесть требуют определённой ПАРЫ в руках («две рукопашные с Балансом
//  ≥0», «пара когтей», «рукопашное + винтовка»). Условие книги одно и то же по
//  форме, а мест применения шесть — если размазать проверку по местам, шестая
//  копия неминуемо разойдётся с первой. Руки читаются через rules/hands.mjs
//  (handHeldItems), а не по всему рюкзаку: книга говорит «вооружён», то есть
//  держит, а не носит с собой.
// ════════════════════════════════════════════════════════════════════════════

import { hasRuleFlag } from "./flags.mjs";
import { handHeldItems } from "./hands.mjs";

export const CAP_CROSSBLOCK       = "dualWield.core.crossblock";
export const CAP_MAINE_GAUCHE     = "dualWield.core.maineGauche";
export const CAP_POUNDER          = "dualWield.core.pounder";
export const CAP_SAVAGE           = "dualWield.core.savage";
export const CAP_GUN_GUARD        = "dualWield.core.gunGuard";

/** +2 Успеха к успешной атаке парными когтями (Дикарь). */
export const SAVAGE_EXTRA_HITS = 2;

/** На сколько ступеней Размера выше обычного можно Парировать с Крестовым Блоком. */
export const CROSSBLOCK_SIZE_STEPS = 1;

const cls  = w => String(w?.system?.weaponClass ?? "");
const cat  = w => String(w?.system?.meleeCategory ?? "").trim().toLowerCase();
const isMeleeCat = (w, name) => cls(w) === "melee" && cat(w) === String(name).toLowerCase();
const balanceOf  = w => Number.parseInt(w?.system?.balance ?? 0, 10) || 0;

/**
 * Что персонаж держит в руках сейчас. Отдельной функцией, чтобы у всех шести
 * Талантов был один ответ на вопрос «вооружён чем» — и чтобы тестам было куда
 * подставить руки, не собирая актора целиком.
 */
export function heldWeapons(actor) {
  return handHeldItems(actor).filter(it => it?.type === "weapon");
}

/**
 * Крестовой Блок: «вооружённый двумя рукопашными оружиями с Балансом не ниже
 * 0». Баланс берётся сырой, БЕЗ модификаций — модификации знает только
 * defense.mjs (getModEffects), и он же уточняет ответ, если надо; условие
 * доступности Таланта книга формулирует по самому оружию.
 *
 * @returns {?{main:object, off:object}} пара, которой блокируем, или null
 */
export function crossblockPair(actor) {
  if (!hasRuleFlag(actor, CAP_CROSSBLOCK)) return null;
  const melees = heldWeapons(actor).filter(w => cls(w) === "melee" && balanceOf(w) >= 0);
  return melees.length >= 2 ? { main: melees[0], off: melees[1] } : null;
}

/**
 * Молотильщик: «вооружённый парой топоров, булав, молотов или их комбинацией».
 * Книга перечисляет три категории и разрешает смешивать — значит проверяется
 * принадлежность каждого из двух к набору, а не совпадение категорий.
 */
const POUNDER_CATEGORIES = ["топор", "булава", "молот"];

export function pounderPair(actor) {
  if (!hasRuleFlag(actor, CAP_POUNDER)) return null;
  const hits = heldWeapons(actor).filter(w => cls(w) === "melee" && POUNDER_CATEGORIES.includes(cat(w)));
  return hits.length >= 2 ? { main: hits[0], off: hits[1] } : null;
}

/**
 * Мэн-Гош: «вооружённый двумя оружиями, одно из которых нож, и НЕ использовав
 * этот нож для атаки в предыдущий Ход, персонаж может перебрасывать тесты на
 * Парирование этим ножом».
 *
 * Три условия, и все три обязательны: две руки заняты, парируем именно ножом,
 * и этим самым ножом не били в прошлый Ход. Список «чем бил» ведёт
 * rules/turn-flags.mjs — событие боя, а не свойство предмета.
 *
 * @param {object} actor
 * @param {object} parryWeapon оружие, которым сейчас парируют
 * @param {string[]} attackedIds id оружия, которым актор бил в прошлый Ход
 */
export function maineGaucheParryReroll(actor, parryWeapon, attackedIds = []) {
  if (!hasRuleFlag(actor, CAP_MAINE_GAUCHE)) return false;
  if (!isMeleeCat(parryWeapon, "Нож")) return false;
  if (heldWeapons(actor).length < 2) return false;
  return !attackedIds.map(String).includes(String(parryWeapon.id));
}

/** Дикарь: «вооружённый парными когтями». */
export function savagePair(actor) {
  if (!hasRuleFlag(actor, CAP_SAVAGE)) return null;
  const claws = heldWeapons(actor).filter(w => isMeleeCat(w, "Когти"));
  return claws.length >= 2 ? { main: claws[0], off: claws[1] } : null;
}

/**
 * Надбавка Успехов к УДАЧНОЙ атаке когтями (Дикарь). Ноль во всех остальных
 * случаях — в том числе когда бьют не когтем из пары, а чем-то ещё: Талант
 * говорит «вооружённый парными когтями… при успешной атаке ИМИ».
 */
export function savageExtraHits(actor, weapon) {
  const pair = savagePair(actor);
  if (!pair || !weapon) return 0;
  const inPair = String(weapon.id) === String(pair.main?.id)
              || String(weapon.id) === String(pair.off?.id);
  return inPair ? SAVAGE_EXTRA_HITS : 0;
}

/**
 * Винтовочная Гарда: «вооружённый рукопашным оружием с Балансом не ниже −1 и
 * винтовкой, выстрелы из неё в рукопашной не получают бонуса +30 на
 * Избегание».
 *
 * Стреляющее оружие передаётся отдельно: бонус снимается только выстрелам ИЗ
 * той самой винтовки, а не любому выстрелу носителя Таланта. «Винтовка» в
 * данных — стрелковое оружие, не пистолет (тот же критерий, каким Карабин
 * отличается от Винтовки в module/combat/attack.mjs).
 */
export function gunGuardCancelsDodgeBonus(actor, firedWeapon) {
  if (!hasRuleFlag(actor, CAP_GUN_GUARD)) return false;
  if (!firedWeapon || cls(firedWeapon) === "melee" || cls(firedWeapon) === "pistol") return false;
  return heldWeapons(actor).some(w => cls(w) === "melee" && balanceOf(w) >= -1);
}

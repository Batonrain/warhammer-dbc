// module/rules/hands.mjs
// ════════════════════════════════════════════════════════════════════════════
//  ЗАНЯТОСТЬ РУК (wdbc-3xqh + wdbc-3hxg). Бюджет, а не Л/П-слоты с конфликтами:
//  каждый удерживаемый предмет занимает 0/1/2 руки, актор имеет бюджет из
//  Трейта Multiple Arms (его rating — уже ПОЛНОЕ число рук, не «доп.» — см.
//  apps/cybernetic-excellence.mjs) минус ампутации (system.conditions.lostHands/
//  ArmsCount). Источники правил — корбук, «Типы Стрелкового Оружия» (стр. 171,
//  Пистолет/Метательное 1р, Винтовка/Длинная Винтовка/Тяжёлое 2р, Пусковое 2р
//  по аналогии), «Бой Несколькими Руками» (стр. 32) и хваты рукопашного
//  (GRIPS, constants/combat.mjs).
//
//  Рука конкретного предмета (какая «Р1» у щита, для карточек HUD) — единый
//  флаг heldHand поверх исторических shieldHand/weaponHand (оставлены как
//  фолбэк на чтение, ничего не мигрируем на живых листах).
// ════════════════════════════════════════════════════════════════════════════

import { parseGrips, RANGED_GRIPS } from "../constants/combat.mjs";
import { resolveWeaponProps, aggregateAuto } from "../combat/weapon-properties.mjs";
import { isHandShield } from "../combat/hand-shield.mjs";
import { isMultipleArmsTrait } from "./cybernetic-excellence.mjs";
import { isFusedByHandOfDeath } from "./hand-of-death.mjs";

const NS = "warhammer-dbc";
const BASE_HANDS = 2;

// Хваты рукопашного, занимающие НЕ одну руку (всё, чего здесь нет — 1 рука:
// «1р» и специализированные хваты Об/Бл/Кл/Мх — это способы удержания той
// же одной руки, не отдельный счётчик). Хв/Зуб/Кист/Щуп — части тела
// (хвост/зуб/голый кулак/щупальце-мутация), а не удерживаемое снаряжение,
// поэтому тоже 0: раньше «Хв» был только в GRIPS (боевые модификаторы уже
// применялись), но не в этом списке — Хвост-мутация из-за этого ошибочно
// съедала руку в бюджете (wdbc, отчёт пользователя).
const MELEE_GRIP_HANDS = { "2р": 2, "П": 0, "Л": 0, "П+Л": 0, "Ног": 0, "Гол": 0, "Хв": 0, "Зуб": 0, "Кист": 0, "Щуп": 0 };

// Класс стрелкового → руки (корбук стр. 171), когда у предмета ещё нет своего
// sys.grips (бэкфилл RANGED_GRIPS по паку не завершён, wdbc-3hxg). thrown —
// метательное/гранаты.
const RANGED_CLASS_HANDS = { pistol: 1, thrown: 1, basic: 2, heavy: 2, launcher: 2, stationary: 0 };

/** Текущий хват рукопашного оружия: выбранный в диалоге атаки/HUD, иначе первый из профиля. */
export function currentMeleeGrip(item) {
  // Рука Смерти (wdbc-hftn, стр. 46): срослось с рукой — всегда Стандартный
  // Хват "1р", даже если раньше был другой (Об/Бл/Кл/Мх/Хв) или предмет
  // изначально двуручный. Игнорирует сохранённый hudGrip намеренно.
  if (isFusedByHandOfDeath(item)) return "1р";
  const flagged = item.getFlag?.(NS, "hudGrip");
  if (flagged) return flagged;
  return parseGrips(item.system?.grips)[0] || "1р";
}

/**
 * Хват дальнобойного (wdbc-3hxg, стр. 166): "1р"/"2р" из того же sys.grips,
 * что и рукопашное. Отдача (Recoil X) запрещает "1р" при S.b < X — тот же
 * гейт, что и в attack-dialog.mjs (resolveSelectionSafe), продублирован тут
 * чистой функцией, чтобы не тянуть Foundry-диалог в бюджет рук. Возвращает
 * null, если у предмета нет sys.grips (тогда решает RANGED_CLASS_HANDS).
 */
function effectiveRangedGripHands(item, actor) {
  const list = parseGrips(item.system?.grips).filter(k => RANGED_GRIPS[k]);
  if (!list.length) return null;
  const flagged = item.getFlag?.(NS, "hudGrip");
  let key = list.includes(flagged) ? flagged : list[0];
  if (key === "1р") {
    const recoilRating = aggregateAuto(resolveWeaponProps(item)).recoilRating || 0;
    const sBonus = Number(actor?.system?.characteristics?.s?.bonus) || 0;
    if (recoilRating > 0 && sBonus < recoilRating) key = list.includes("2р") ? "2р" : key;
  }
  return key === "1р" ? 1 : key === "2р" ? 2 : null;
}

/**
 * Сколько рук занимает предмет ПРЯМО СЕЙЧАС (0-2). Independent/Wrist —
 * всегда 0, они и есть исключение из правила «оружие занимает руку». actor —
 * нужен только дальнобойному (гейт Отдачи по S.b); по умолчанию — носитель
 * предмета (у настоящих Foundry-документов item.parent это и есть актор).
 */
export function weaponHandsRequired(item, actor = item?.parent) {
  if (!item || item.type !== "weapon") return 0;
  const sys = item.system || {};
  if (isHandShield(item)) return 1;
  // Рука Смерти: сросшееся оружие работает одной рукой, даже если профиль
  // требовал двух (стр. 46) — гейт до ветвления мелейное/дальнобойное, оба
  // случая читают sys.grips/RANGED_CLASS_HANDS ниже, которых это правило не
  // касается.
  if (isFusedByHandOfDeath(item)) return 1;
  if (sys.weaponClass === "melee") return MELEE_GRIP_HANDS[currentMeleeGrip(item)] ?? 1;
  const auto = aggregateAuto(resolveWeaponProps(item));
  if (auto.independent || auto.wrist) return 0;
  // Стационарное: класс решает РАНЬШЕ данных (wdbc-7utm). У станкового хват
  // «2р» описывает, как за него берутся, а не сколько рук оно отнимает у
  // бюджета — оружие стоит на станке. Пока поле grips было пустым, сюда
  // доходил классовый запас с нулём; после бэкфилла заполненное «2р» вернуло
  // бы 2 и турель начала бы съедать обе руки. Единственный класс, где данные
  // и запас расходятся намеренно.
  if (sys.weaponClass === "stationary") return RANGED_CLASS_HANDS.stationary;
  const gripHands = effectiveRangedGripHands(item, actor);
  if (gripHands != null) return gripHands;
  return RANGED_CLASS_HANDS[sys.weaponClass] ?? 1;
}

/** Рука предмета (left/right/null) — heldHand, с фолбэком на старые флаги. */
export function getHeldHand(item) {
  return item?.getFlag?.(NS, "heldHand")
      ?? item?.getFlag?.(NS, "shieldHand")
      ?? item?.getFlag?.(NS, "weaponHand")
      ?? null;
}

/** Единая запись руки предмета — новый флаг, старые больше не пишутся. */
export async function setHeldHand(item, hand) {
  if (!item) return;
  await item.setFlag(NS, "heldHand", hand);
}

/**
 * Рейтинг Трейта Multiple Arms — уже ПОЛНОЕ число рук (raw «Multiple Arms
 * (4)» = четыре руки, не «+4»), см. apps/cybernetic-excellence.mjs:BASE_ARMS.
 * Трейта нет — обычные 2 руки.
 */
export function baseHandsFromTraits(actor) {
  const trait = actor?.items ? [...actor.items].find(isMultipleArmsTrait) : null;
  return trait ? (Number(trait.system?.rating) || BASE_HANDS) : BASE_HANDS;
}

/** Сколько рук у актора доступно прямо сейчас: Трейт минус ампутации (0-31/32). */
export function maxHands(actor) {
  const cond = actor?.system?.conditions || {};
  const lost = (Number(cond.lostHandsCount) || 0) + (Number(cond.lostArmsCount) || 0);
  return Math.max(0, baseHandsFromTraits(actor) - lost);
}

/** Экипированные предметы, реально занимающие руки (щиты — тоже type:"weapon"). */
export function handHeldItems(actor) {
  return (actor?.items ? [...actor.items] : [])
    .filter(i => i.type === "weapon" && i.system?.equipped && weaponHandsRequired(i) > 0);
}

/**
 * Сводка занятости рук актора. exclude — id предмета, который не учитывать
 * (проверка «хватит ли рук, если снять/не считая вот этот»).
 */
export function handsOccupied(actor, { exclude = null } = {}) {
  const items = handHeldItems(actor).filter(i => i.id !== exclude);
  const used  = items.reduce((sum, i) => sum + weaponHandsRequired(i), 0);
  const max   = maxHands(actor);
  return { max, used, free: Math.max(0, max - used), over: used > max, items };
}

/**
 * Хватит ли рук, чтобы ДОПОЛНИТЕЛЬНО экипировать предмет. Проверяет только
 * прирост от этого конкретного действия — уже существующие «нелегальные»
 * связки на старых листах персонажей этим не блокируются и не трогаются.
 */
export function canEquipInHands(actor, item) {
  const need = weaponHandsRequired(item);
  if (need <= 0) return true;
  return need <= handsOccupied(actor, { exclude: item.id }).free;
}

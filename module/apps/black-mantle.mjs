// module/apps/black-mantle.mjs
// ════════════════════════════════════════════════════════════════════════
//  Талант Геносемени «Black Mantle / Чёрная Мантия» (корбук, гл. 3; 3-b530):
//  «за полудействие может ввести Меланохром в усиленный режим (радиационная
//  защита −2 вместо −1, любой урон в T от радиации −1 до минимума 1) или
//  вывести его из этого режима».
//
//  Режим — постоянное состояние «вкл/выкл» между действиями, поэтому это
//  флаг на самом Таланте (blackMantleOn), тем же приёмом, что techActive у
//  энергосистем (sheets/tabs/tech.mjs) и illusionMaintained у Иллюзии
//  Нормальности (apps/illusion-of-normality.mjs); а не отдельный предмет-
//  подспособность rules/toggle-abilities.mjs — тому нужен второй предмет на
//  каждый режим, тут режим один. Читают флаг rules/radiation-scene.mjs
//  (защита) и combat/radiation.mjs (урон Rad). Каждое переключение — в любую
//  сторону — списывает полудействие (1 ОД) через spendActionPoints; вне боя
//  экономика действий не считается, там режим переключается бесплатно.
// ════════════════════════════════════════════════════════════════════════

import { itemIs } from "../rules/item-marker.mjs";
import { BLACK_MANTLE_KEY, BLACK_MANTLE_ON_FLAG, blackMantleAvailable } from "../rules/radiation-scene.mjs";
import { spendActionPoints } from "../combat/action-economy.mjs";

const SYSTEM = "warhammer-dbc";
/** «За полудействие» — 1 ОД, как у Расплавления и Драконьего Рыцаря. */
const HALF_ACTION_AP = 1;

/** Это Талант «Чёрная Мантия»? Опознаётся по ключу Возможности или по имени (копия без ключа до «Обновить мир»), как и читатель. */
export function isBlackMantleItem(item) {
  return itemIs(item, "talent", BLACK_MANTLE_KEY, "Black Mantle");
}

/** Включён ли усиленный режим (по умолчанию — нет). */
export function isBlackMantleOn(item) {
  return !!(item?.getFlag?.(SYSTEM, BLACK_MANTLE_ON_FLAG) ?? item?.flags?.[SYSTEM]?.[BLACK_MANTLE_ON_FLAG]);
}

/**
 * Переключить режим за полудействие. Возвращает true, если режим теперь такой,
 * как просили; false — не Мантия или не хватило ОД (флаг не тронут, причину
 * уже показал spendActionPoints). То же состояние, что уже стоит, ничего не
 * стоит. Талант вне актора (предмет из компендиума) платить не за что.
 *
 * XIX легиону Мантия недоступна (blackMantleAvailable): включить нельзя, а оставшийся
 * от смены легиона флаг гасится бесплатно — режим там и так не действовал.
 */
export async function setBlackMantleOn(item, on) {
  if (!isBlackMantleItem(item)) return false;
  const want = !!on;
  if (want === isBlackMantleOn(item)) return true;
  const actor = item.parent;
  if (actor && !blackMantleAvailable(actor)) {
    if (want) {
      ui.notifications?.warn("Чёрная Мантия недоступна легиону XIX (Гвардия Ворона и её ордены): Меланохром там защиты не даёт, усиливать нечего.");
      return false;
    }
    await item.setFlag(SYSTEM, BLACK_MANTLE_ON_FLAG, false);
    return true;
  }
  if (actor && !(await spendActionPoints(actor, HALF_ACTION_AP))) return false;
  await item.setFlag(SYSTEM, BLACK_MANTLE_ON_FLAG, want);
  return true;
}

/** Панель для листа Таланта: тумблер и пояснение. Пусто у остальных Талантов и у предмета вне актора. */
export function blackMantleHtml(item, actor) {
  if (!isBlackMantleItem(item) || !actor) return "";
  if (!blackMantleAvailable(actor)) {
    return `<div class="black-mantle-panel">
    <label class="black-mantle-toggle">
      <input type="checkbox" class="black-mantle-cb" data-item-id="${item.id}" disabled/>
      Усиленный режим Меланохрома
    </label>
    <div class="black-mantle-status">Недоступен: Чёрная Мантия не работает у легиона XIX (Гвардия Ворона и её ордены) — Меланохром там защиты от радиации не даёт, усиливать нечего.</div>
  </div>`;
  }
  const on = isBlackMantleOn(item);
  return `<div class="black-mantle-panel">
    <label class="black-mantle-toggle">
      <input type="checkbox" class="black-mantle-cb" data-item-id="${item.id}" ${on ? "checked" : ""}/>
      Усиленный режим Меланохрома (переключение — полудействие, 1 ОД в бою)
    </label>
    <div class="black-mantle-status">${on
      ? "Включён: радиационная защита −2 вместо −1, урон Rad по вам на 1 меньше (не ниже 1). Нужен установленный Меланохром."
      : "Выключен: Меланохром работает обычно (защита −1)."}</div>
  </div>`;
}

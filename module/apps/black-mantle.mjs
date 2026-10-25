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
//  (защита) и combat/radiation.mjs (урон Rad). Полудействие игрок тратит
//  сам: система экономию действий по этому Таланту не списывает.
// ════════════════════════════════════════════════════════════════════════

import { itemHasKey } from "../rules/item-marker.mjs";
import { BLACK_MANTLE_KEY, BLACK_MANTLE_ON_FLAG } from "../rules/radiation-scene.mjs";

const SYSTEM = "warhammer-dbc";

/** Это Талант «Чёрная Мантия»? Опознаётся по ключу Возможности, как и читатель. */
export function isBlackMantleItem(item) {
  return item?.type === "talent" && itemHasKey(item, BLACK_MANTLE_KEY);
}

/** Включён ли усиленный режим (по умолчанию — нет). */
export function isBlackMantleOn(item) {
  return !!(item?.getFlag?.(SYSTEM, BLACK_MANTLE_ON_FLAG) ?? item?.flags?.[SYSTEM]?.[BLACK_MANTLE_ON_FLAG]);
}

/** Переключить режим. На чужом предмете (не Мантия) — ничего. */
export async function setBlackMantleOn(item, on) {
  if (!isBlackMantleItem(item)) return;
  await item.setFlag(SYSTEM, BLACK_MANTLE_ON_FLAG, !!on);
}

/** Панель для листа Таланта: тумблер и пояснение. Пусто у остальных Талантов и у предмета вне актора. */
export function blackMantleHtml(item, actor) {
  if (!isBlackMantleItem(item) || !actor) return "";
  const on = isBlackMantleOn(item);
  return `<div class="black-mantle-panel">
    <label class="black-mantle-toggle">
      <input type="checkbox" class="black-mantle-cb" data-item-id="${item.id}" ${on ? "checked" : ""}/>
      Усиленный режим Меланохрома (полудействие)
    </label>
    <div class="black-mantle-status">${on
      ? "Включён: радиационная защита −2 вместо −1, урон Rad по вам на 1 меньше (не ниже 1). Нужен установленный Меланохром."
      : "Выключен: Меланохром работает обычно (защита −1)."}</div>
  </div>`;
}

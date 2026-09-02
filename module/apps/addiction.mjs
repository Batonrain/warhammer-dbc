// module/apps/addiction.mjs
// ════════════════════════════════════════════════════════════════════════
//  Мутация «Addiction / Зависимость» (стр. 441, roll d100 1…2, wdbc-1rno):
//  панель на листе Мутации — сколько суток прошло с последнего утоления,
//  кнопка «Утолить». Что именно утоляет (13 субмутаций — еда, яд, кровь
//  врага…) остаётся отыгрышем, здесь только состояние и число (см. шапку
//  rules/addiction.mjs).
// ════════════════════════════════════════════════════════════════════════

import { isAddictionItem, addictionDaysSince, satisfyAddiction } from "../rules/addiction.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";

export { isAddictionItem };

/** Панель для листа предмета — пусто, если это не «Зависимость». */
export function addictionPanelHtml(item) {
  if (!isAddictionItem(item)) return "";
  const days = addictionDaysSince(item, game.time?.worldTime ?? 0);
  const unsatisfied = days >= 1;
  const status = unsatisfied
    ? `${rollIcon("warn", "#ff6b4d")}Не утолена уже ${Math.floor(days)} сут. — штраф −10 на тесты Навыков`
    : `${rollIcon("blood", "#8fd0ff")}Утолена${days > 0 ? ` (${days.toFixed(1)} сут. назад)` : ""}`;
  return `<div class="addiction-panel">
    <div class="addiction-status">${status}</div>
    <button type="button" class="addiction-satisfy-btn" data-item-id="${item.id}">
      ${rollIcon("blood", "#ffd24d")}Утолить
    </button>
  </div>`;
}

/** Нажатие кнопки «Утолить» на листе Мутации. */
export async function useSatisfyAddiction(item) {
  await satisfyAddiction(item);
}

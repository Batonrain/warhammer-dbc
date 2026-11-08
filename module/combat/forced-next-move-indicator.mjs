// module/combat/forced-next-move-indicator.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Видимый индикатор тумблера «следующий сдвиг — вынужденный» (wdbc-98xsv):
//  плашка внизу экрана, пока тумблер включён хоть у одного актора, с кнопкой
//  «Отключить». Забытый тумблер даёт обход лимита пути, поэтому состояние не
//  должно быть заметно только в меню Движения. Состояние и его сброс —
//  combat/forced-next-move.mjs; здесь только отрисовка.
// ════════════════════════════════════════════════════════════════════════════

import { onNextMoveForcedChange, nextMoveForcedEntries, clearNextMoveForced } from "./forced-next-move.mjs";

const CHIP_ID = "wh-forced-next-chip";

/** Показать/обновить/убрать плашку по списку включённых тумблеров. */
export function renderForcedNextIndicator(entries = nextMoveForcedEntries()) {
  if (typeof document === "undefined") return;
  let chip = document.getElementById(CHIP_ID);
  if (!entries.length) {
    chip?.remove();
    return;
  }
  if (!chip) {
    chip = document.createElement("div");
    chip.id = CHIP_ID;
    chip.className = "wh-forced-next-chip";
    chip.setAttribute("role", "status");
    document.body.appendChild(chip);
  }
  const names = entries.map(e => e.name).filter(Boolean).join(", ");
  const text = document.createElement("span");
  text.textContent = `Вынужденный сдвиг включён${names ? ` (${names})` : ""}: следующее перемещение не считается в лимит пути`;
  const off = document.createElement("button");
  off.type = "button";
  off.textContent = "Отключить";
  off.addEventListener("click", () => clearNextMoveForced());
  chip.replaceChildren(text, off);
}

export function initForcedNextIndicator() {
  onNextMoveForcedChange(renderForcedNextIndicator);
}

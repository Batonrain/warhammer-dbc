// module/rules/psy-focus.mjs
// ════════════════════════════════════════════════════════════════════════
//  Фокус Дисциплины (wdbc-l6zg, core.json стр.293): «Фокус Дисциплины
//  выбирается, как правило, при создании персонажа... Псайкер может изучать
//  психосилы дисциплины своего фокуса без всякого изучения». В системе пока
//  нет механизма «изучения» психосил вообще (drag-and-drop без гейта, см.
//  wdbc-1rno) — упрощать пока нечего, поэтому Фокус здесь ЧИСТО ДАННЫЕ:
//  выбор игрока (actor.system.psyker.focusDisciplines) плюс дисциплины,
//  дарованные способностями вроде Perfect Sorcerer, — видимые на вкладке
//  МИСТИКА (sheets/sheet-helpers.mjs → templates/actor/parts/tab-psy.hbs).
//  Когда появится механика изучения психосил, она читает отсюда же.
// ════════════════════════════════════════════════════════════════════════

import { perfectSorcererFocusDisciplines } from "./perfect-sorcerer.mjs";

/** Фокусы, дарованные актору способностями (в обход обычного выбора игрока). */
export function grantedFocusDisciplines(actor) {
  return perfectSorcererFocusDisciplines(actor);
}

/** Игроком выбранные Фокусы — сырое поле актора, без дарованных способностями. */
export function ownFocusDisciplines(actor) {
  const list = actor?.system?.psyker?.focusDisciplines;
  return Array.isArray(list) ? list.filter(Boolean) : [];
}

/** Итоговый набор ключей дисциплин с Фокусом — выбор игрока ∪ дарованное способностями. */
export function effectiveFocusDisciplines(actor) {
  return Array.from(new Set([...ownFocusDisciplines(actor), ...grantedFocusDisciplines(actor)]));
}

/** Есть ли у актора Фокус дисциплины `key` (свой или дарованный). */
export function hasFocusDiscipline(actor, key) {
  return !!key && effectiveFocusDisciplines(actor).includes(key);
}

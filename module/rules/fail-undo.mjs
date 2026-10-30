// module/rules/fail-undo.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Откат последствий провала теста (task-e30b). Чистые данные, без Foundry.
//
//  Общий исход теста (rules/kind-outcome.mjs) накладывает последствия провала
//  сразу при броске: Шок Инфернальной Воли («N+ Провала», fail-degree-triggers),
//  Ступор Гипно-Шрамов (Крит. Провал теста I). Если провал потом засчитывают
//  успехом уже ПОСЛЕ карточки — переброс за Очко, «+10», «Провал → Очко
//  Бесчестия → Успех», Хирургия Легиона, Мастерство, — наложенное должно
//  сниматься. Как у Страха (combat/fear.mjs::failUndo): исход возвращает
//  `failUndo`, карточка хранит его во флаге, обработчики кнопок откатывают
//  (combat/fear.mjs::revertCardFailure).
//
//  Форма: { infernalWillShock?: undo, hypno?: undo }, где undo — то, что вернул
//  applyShockRow / applyHypnoScarsStun (`{ conditions: [...], … }`). Ключи
//  последствий, пришедших из реестра «N+ Провала», совпадают с именем
//  `handler` записи (FAIL_DEGREE_TRIGGERS).
// ════════════════════════════════════════════════════════════════════════════

const NS = "warhammer-dbc";

/** Флаг карточки с откатом. */
export const FAIL_UNDO_FLAG = "failUndo";
/** Флаг карточки: откат уже выполнен или передан переброшенной карточке — второй раз не откатывать. */
export const FAIL_UNDO_SETTLED_FLAG = "failUndoSettled";

/** Подписи последствий для строки карточки («↩ Сняты последствия: …»). */
const LABELS = {
  infernalWillShock: "Шок Инфернальной Воли",
  hypno: "Ступор Гипно-Шрамов"
};

/**
 * Откат для флага карточки: добавляет uuid бросавшего (откатывать надо ему, а не тому, кто нажал кнопку).
 * Пустой откат — null: карточка без последствий флага не получает.
 * @param {{uuid?:string}|null} actor
 * @param {?object} failUndo  outcome.failUndo
 */
export function cardFailUndo(actor, failUndo) {
  if (!failUndo || !Object.keys(failUndo).length) return null;
  return { actorUuid: actor?.uuid ?? "", ...failUndo };
}

/** Откат, записанный на карточке (null — нет). */
export function failUndoOf(message) {
  return message?.getFlag?.(NS, FAIL_UNDO_FLAG) ?? message?.flags?.[NS]?.[FAIL_UNDO_FLAG] ?? null;
}

/**
 * Что делать с откатом исходной карточки при «Переброс за Очко» (task-e30b). Чистое решение, проверяется тестом.
 *  • исходная карточка уже закрыта (откат снят или передан) — ничего: повторный переброс той же карточки
 *    не должен ни откатывать второй раз, ни размножать откат;
 *  • переброс удался (hit === true) — revert: снять последствия;
 *  • переброс провален снова (hit === false) — carry: откат переезжает на новую карточку (старую пометить);
 *  • порога нет (hit === null) — ничего.
 * @returns {{revert:boolean, carry:boolean}}
 */
export function rerollFailUndoPlan({ prevFailUndo, hit, settled = false } = {}) {
  if (!prevFailUndo || settled) return { revert: false, carry: false };
  return { revert: hit === true, carry: hit === false };
}

/** Названия последствий, которые есть в откате. */
export function failUndoLabels(failUndo) {
  return Object.keys(LABELS).filter(k => failUndo?.[k]).map(k => LABELS[k]);
}

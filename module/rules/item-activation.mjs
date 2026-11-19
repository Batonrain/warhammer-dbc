// module/rules/item-activation.mjs
// ════════════════════════════════════════════════════════════════════════
//  АКТИВАЦИЯ «ДО КОНЦА БОЯ ИЛИ СЦЕНЫ» — ядро без Foundry.
//
//  Книга элитных архетипов (корбук, «Элитные архетипы») то и дело пишет одну
//  и ту же форму: «может потратить Очко Бесчестия, чтобы до конца боя/сцены
//  получить X» (Возвышенные Латы, Лик Гнева, Разоритель Хабов, Крадущийся в
//  Тенях…). Раньше такие Таланты лежали текстом, а игрок держал «включено» в
//  голове и сам прибавлял бонус.
//
//  Теперь это данные, без нового вида записи Конструктора:
//    • кнопка — обычная запись kind:"script" с ценой (capabilityCostPool/
//      Amount), её код зовёт activateItemUntil(item) (apps/item-activation.mjs,
//      доступна скриптам через item-script.mjs). Цена списывается ПОСЛЕ кода
//      и только если код не отказал (runMechScriptEntry) — повторное нажатие
//      по уже включённому Таланту ничего не тратит;
//    • то, что действует «пока включено», — любые записи того же предмета с
//      условием «Когда» when.requireActivated (rules/mech-when.mjs). Живые
//      записи (переброс, модификатор теста) спрашивают гейт в момент броска,
//      долговечные (Очки Брони, Характеристика) пересобираются при смене
//      флага (mechanicsRelevantChange, apps/mechanics.mjs).
//
//  Состояние — флаг на самом предмете актора:
//    flags.warhammer-dbc.activated = { combatId, at }
//  combatId — бой, в котором включили ("" — вне боя). Снимается:
//    • концом ЭТОГО боя (deleteCombat) — включённое вне боя бой не снимает;
//    • кнопкой ГМа «🎬 Новая сцена» / «⏻ Сессия» — всё сразу.
// ════════════════════════════════════════════════════════════════════════

const NS = "warhammer-dbc";

/** Флаг состояния на предмете. */
export const ACTIVATED_FLAG = "activated";

/** Состояние активации предмета или null (флаги и живого документа, и сырых данных). */
export function activationState(item) {
  const raw = item?.flags?.[NS]?.[ACTIVATED_FLAG];
  return raw && typeof raw === "object" ? raw : null;
}

/** Включён ли предмет прямо сейчас. */
export function isItemActivated(item) {
  return !!activationState(item);
}

/** Данные флага при включении (чистая функция). */
export function activationData({ combatId = "", at = 0 } = {}) {
  return { combatId: String(combatId || ""), at: Number(at) || 0 };
}

/**
 * Снимает ли конец боя `combatId` активацию с таким состоянием. Включённое
 * вне боя ("") боем не снимается — только концом сцены.
 */
export function endsWithCombat(state, combatId) {
  return !!state && !!state.combatId && state.combatId === String(combatId || "");
}

/** Есть ли в Механике предмета записи, которые ждут активации (гейт requireActivated). */
export function hasActivationGatedEntries(groups) {
  const walk = entries => (entries || []).some(e =>
    e?.when?.requireActivated || (e?.kind === "group" && walk(e.group?.entries)));
  return (groups || []).some(g => walk(g?.entries));
}

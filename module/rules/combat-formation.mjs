// module/rules/combat-formation.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Combat Formation / Боевое Построение, раздача соратникам (Общие Таланты,
//  корбук стр. 62).
//  [книга] «Персонаж и все его соратники, с которыми он поделился своими
//  планами, получают +1 к Инициативе и могут использовать I.b вместо A.b при
//  броске на Инициативу.»
//
//  Сам носитель получает своё +1 и I.b от Таланта (эффект и возможность
//  combat.initiativeChar.int, rules/initiative.mjs). Соратникам то же даёт
//  ОТМЕТКА на их листе — флаг combatFormation {from, name}: её ставит кнопка
//  Таланта на выбранных (T) токенов (combat/combat-formation.mjs), а лист
//  соратника читает здесь:
//    • +1 к Инициативе — rules/character.mjs (талантный вклад);
//    • I.b вместо A.b — rules/initiative.mjs::initiativeCharKey.
//  Отметка живёт «до конца боя» (hooks.mjs, deleteCombat).
//
//  [допущение] Книга не называет срок: «поделился планами» — до конца этого
//  боя; снять раньше можно правкой флага или повторной раздачей. Тот, кому
//  отметка досталась от самого себя (носитель), второй +1 не получает.
//  Чистая логика без Foundry.
// ════════════════════════════════════════════════════════════════════════════

const NS = "warhammer-dbc";

/** Имя флага на листе соратника. */
export const COMBAT_FORMATION_FLAG = "combatFormation";

/** Сколько Инициативы даёт Построение. */
export const COMBAT_FORMATION_INIT_BONUS = 1;

/** Характеристика, которую Построение разрешает вместо A.b. */
export const COMBAT_FORMATION_CHAR = "int";

/**
 * Отметка Построения на акторе: {from, name} либо null.
 * Читает getFlag, а без него — сырые флаги (тесты строят голые объекты).
 */
export function sharedFormation(actor) {
  const raw = actor?.getFlag?.(NS, COMBAT_FORMATION_FLAG) ?? actor?.flags?.[NS]?.[COMBAT_FORMATION_FLAG];
  return raw && typeof raw === "object" ? raw : null;
}

/** Вклад отметки в Инициативу (0, если отметки нет). */
export function sharedFormationInitBonus(actor) {
  return sharedFormation(actor) ? COMBAT_FORMATION_INIT_BONUS : 0;
}

/**
 * Какие токены получат отметку: все выбранные, кроме самого носителя и тех,
 * у кого она уже стоит от него же.
 * @param {{uuid:string}} carrier носитель Таланта
 * @param {Array<{uuid:string}>} targets акторы выбранных токенов
 */
export function formationRecipients(carrier, targets) {
  const seen = new Set();
  const out = [];
  for (const t of targets ?? []) {
    if (!t?.uuid || t.uuid === carrier?.uuid || seen.has(t.uuid)) continue;
    seen.add(t.uuid);
    if (sharedFormation(t)?.from === carrier?.uuid) continue;
    out.push(t);
  }
  return out;
}

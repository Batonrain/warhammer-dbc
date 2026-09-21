// module/documents/combat.mjs
// ════════════════════════════════════════════════════════════════════════════
//  ТАЙ-БРЕЙК ИНИЦИАТИВЫ (стр. 12): «Если два персонажа имеют равную
//  Инициативу, первым ходит тот, у которого выше Ловкость (А)» — сравнение
//  ПОЛНОЙ характеристики, а не Бонуса, которым считается сама Инициатива.
//
//  Foundry по умолчанию (Combat#_sortCombatants) при равенстве бросков
//  сравнивает id комбатантов — произвольный порядок, никак не связанный с
//  Ловкостью. Здесь — та же сортировка с одной вставленной ступенью между
//  «сравнить итог» и «сравнить id».
// ════════════════════════════════════════════════════════════════════════════

export class WarhammerCombat extends Combat {
  /** @override */
  _sortCombatants(a, b) {
    // typeof, не Number.isNumeric (полифилл Foundry, не гарантирован в
    // тестовом окружении) — initiative у Combatant всегда либо число, либо
    // null, второе не отличить от третьего варианта иначе.
    const ia = typeof a.initiative === "number" ? a.initiative : -Infinity;
    const ib = typeof b.initiative === "number" ? b.initiative : -Infinity;
    if (ia !== ib) return ib - ia;
    const aga = Number(a.actor?.system?.characteristics?.ag?.total) || 0;
    const agb = Number(b.actor?.system?.characteristics?.ag?.total) || 0;
    if (aga !== agb) return agb - aga;
    return a.id > b.id ? 1 : -1;
  }
}

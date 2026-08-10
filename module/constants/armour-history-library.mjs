// module/constants/armour-history-library.mjs
// ════════════════════════════════════════════════════════════════════════
//  Компендиум warhammer-dbc.armour-histories — СПРАВОЧНАЯ библиотека Историй
//  и Особенностей комплекта силовой брони Астартес («Силовая броня: без
//  шлема и особенности», три таблицы к10: История/Шрамы войны/Легенда), по
//  одному предмету (type:"armourHistoryEntry") на запись PA_TABLES
//  (module/constants/power-armour-lore.mjs).
//
//  СОЗНАТЕЛЬНО НЕ проведено через «Механику»: результат — не грант актору
//  при получении предмета, а описание, приписанное к КОНКРЕТНОЙ броне
//  (system.history.* на самом предмете брони), выбираемое или бросаемое
//  через свою готовую панель (module/apps/armour-history.mjs, вкладка листа
//  брони «Особенность комплекта») — этот механизм уже работает и его не
//  трогаем. Библиотека — genererируемая из PA_TABLES (источник истины —
//  код), чисто для чтения/поиска и Источника; не заменяет и не дублирует
//  живой пикер на самой броне.
// ════════════════════════════════════════════════════════════════════════

import { PA_TABLES, PA_TABLE_ORDER, PA_SOURCE } from "./power-armour-lore.mjs";

/** Предметы-справки для компендиума «Истории силовой брони». */
export function armourHistoryLibrary() {
  const out = [];
  for (const key of PA_TABLE_ORDER) {
    const table = PA_TABLES[key];
    for (const e of table.entries) {
      out.push({
        name: e.name,
        type: "armourHistoryEntry",
        img: "icons/svg/upgrade.svg",
        folder: table.label,
        system: {
          table: key,
          rollMin: e.min,
          rollMax: e.max,
          description: e.desc || "",
          effect: e.effect || "",
          hasChoice: !!e.choice,
          choiceLabel: e.choice?.label || "",
          choicePlaceholder: e.choice?.placeholder || "",
          zoneRoll: !!e.zoneRoll,
          bookSource: PA_SOURCE
        }
      });
    }
  }
  return out;
}

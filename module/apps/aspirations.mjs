// module/apps/aspirations.mjs
// ════════════════════════════════════════════════════════════════════════
//  Стремления (Black Crusade, стр. 22): выбор в шапке листа читает и
//  компендиум warhammer-dbc.aspirations, и предметы-Стремления, заведённые в
//  самом мире. Своё Стремление можно завести любым из двух способов — в
//  библиотеке или прямо кнопкой «Создать предмет», — и оно окажется в списке.
//
//  Раньше мир не читался вовсе: список собирался из одного компендиума, и
//  созданное за столом Стремление просто не появлялось, без единого слова.
//
//  Сведение источников — в rules/aspiration-sources.mjs: там же ключ для
//  предмета мира (у него своего ключа обычно нет) и защита от повторов.
// ════════════════════════════════════════════════════════════════════════

import { aspirationLibrary } from "../constants/aspirations.mjs";
import { registerPackCache, packEntries } from "./origin-shared.mjs";
import { aspirationChoices, findAspiration } from "../rules/aspiration-sources.mjs";

const PACK = "warhammer-dbc.aspirations";
export const ASPIRATION_TAG = "aspiration";

registerPackCache(PACK, ASPIRATION_TAG);

const fallbackEntries = () => aspirationLibrary().map(a => ({
  key: a.system.key, name: a.name, table: a.system.table, n: a.system.n,
  mods: a.system.mods, description: a.system.description
}));

/** Стремления, заведённые в мире. Вне игры (тесты) их просто нет. */
const worldItems = () => {
  try { return game.items?.filter?.(i => i.type === "aspiration") ?? []; }
  catch { return []; }
};

/** Опции выпадающего списка для таблицы (pride/motivation/disgrace). */
export function aspirationOptions(table) {
  return aspirationChoices(packEntries(ASPIRATION_TAG, fallbackEntries), worldItems(), table);
}

/** Запись по ключу: сперва компендиум и константы, затем предметы мира. */
export function aspirationByKey(key) {
  const found = findAspiration(packEntries(ASPIRATION_TAG, fallbackEntries), worldItems(), key);
  return found ? { ...found, id: found.key, desc: found.description } : null;
}

// module/apps/aspirations.mjs
// ════════════════════════════════════════════════════════════════════════
//  Стремления (Black Crusade, стр. 22): дропдаун на вкладке ЗАПИСИ читает
//  компендиум warhammer-dbc.aspirations, а не константы — значит, ГМ может
//  завести своё Стремление прямо в библиотеке, и оно появится в списке
//  (тот же приём, что у Родных миров и Предсказаний, см. origin-shared.mjs).
// ════════════════════════════════════════════════════════════════════════

import { aspirationLibrary } from "../constants/aspirations.mjs";
import { registerPackCache, packEntries } from "./origin-shared.mjs";

const PACK = "warhammer-dbc.aspirations";
export const ASPIRATION_TAG = "aspiration";

registerPackCache(PACK, ASPIRATION_TAG);

const fallbackEntries = () => aspirationLibrary().map(a => ({
  key: a.system.key, name: a.name, table: a.system.table, n: a.system.n,
  mods: a.system.mods, description: a.system.description
}));

/** Опции дропдауна для конкретной таблицы (pride/motivation/disgrace). */
export function aspirationOptions(table) {
  return packEntries(ASPIRATION_TAG, fallbackEntries).filter(o => o.table === table);
}

/** Резолв записи по ключу "table:n" — сперва компендиум, потом константы (fallback). */
export function aspirationByKey(key) {
  if (!key) return null;
  const found = packEntries(ASPIRATION_TAG, fallbackEntries).find(o => o.key === key);
  return found ? { ...found, id: key, desc: found.description } : null;
}

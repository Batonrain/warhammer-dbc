// module/data/string-list.mjs
// ════════════════════════════════════════════════════════════════════════════
//  СПИСОК СТРОК-КЛЮЧЕЙ В СХЕМЕ — и починка того, что успела испортить старая.
//
//  Свойства брони (["hard","soft",…]), пути отравления препарата, снимаемые
//  модификацией свойства оружия — это строки. Их схемы были описаны как
//  ArrayField(new ObjectField()), а ObjectField молча приводит строку к {}:
//  в живой игре при первой же правке предмета ключи исчезали, оставляя
//  [{}, {}] (найдено живой проверкой 25.09.2026, wdbc-x1nz.2.81 — у
//  Силовой Брони Сороритас на персонаже игрока свойств не осталось).
//
//  Тип элемента берётся по тому, что код туда КЛАДЁТ (скилл dbc-datamodel).
//
//  Уже испорченные записи восстановить из самих себя нельзя — пустой объект
//  не помнит, какой ключ в нём был. Поэтому migrateData заменяет каждый такой
//  {} меткой LOST_KEY: читатели её не знают и пропускают, а мировая миграция
//  (migrations/string-list-restore.mjs) по метке отличает «ключи потеряны» от
//  «свойств и не было» и берёт настоящие ключи из компендиума-источника.
// ════════════════════════════════════════════════════════════════════════════

/** Метка «здесь был ключ, но схема его потеряла» — ждёт восстановления. */
export const LOST_KEY = "__lostKey__";

/** Поле схемы: список строк-ключей. */
export function stringList(label) {
  const { ArrayField, StringField } = foundry.data.fields;
  return new ArrayField(new StringField(), { label });
}

/**
 * Приводит сырой список к строкам: строка остаётся, объект (след старой
 * схемы) становится LOST_KEY, прочее выбрасывается. Не массив — как есть.
 */
export function repairStringList(value) {
  if (!Array.isArray(value)) return value;
  const out = [];
  for (const v of value) {
    if (typeof v === "string") out.push(v);
    else if (v && typeof v === "object") out.push(LOST_KEY);
  }
  return out;
}

/** Правит source на месте по пути «a.b.c», если там список. */
export function repairStringListAt(source, path) {
  const parts = path.split(".");
  let node = source;
  for (const k of parts.slice(0, -1)) {
    node = node?.[k];
    if (!node || typeof node !== "object") return;
  }
  const last = parts.at(-1);
  if (node && Array.isArray(node[last])) node[last] = repairStringList(node[last]);
}

// module/rules/toggle-abilities.mjs
// ════════════════════════════════════════════════════════════════════════════
//  ПЕРЕКЛЮЧАЕМЫЕ ПОДСПОСОБНОСТИ — ядро без Foundry.
//
//  Книга то и дело даёт способность в форме «раз в Ход выбери один из N
//  эффектов»: Локус Герольда (шесть эффектов, переключается свободным
//  действием), Благословение Кровавого Бога (пять), Игры и Забавы Твари
//  Нургла, Аура Перемен Повелителя Перемен. Раньше все N лежали прозой в
//  одном Таланте, и за столом ГМ держал активный в голове.
//
//  Теперь это данные. Родитель — обычный Талант или Черта с описанием группы:
//    flags.warhammer-dbc.toggleGroup = { label, mode }
//      label — заголовок группы на листе («Локус»);
//      mode "one"  — активна не более одной подспособности (книжное «выбери
//                    один из»), включение гасит соседей;
//      mode "many" — включать можно сколько угодно.
//
//  Подспособность — тоже обычный предмет на акторе, со своей Механикой
//  (Конструктор) и двумя флагами:
//    flags.warhammer-dbc.toggleOf = id предмета-родителя;
//    flags.warhammer-dbc.toggleOn = включена ли прямо сейчас.
//
//  Почему отдельным предметом, а не записью внутри родителя: у предмета уже
//  есть ВСЁ, что нужно подспособности, — Механика Конструктора, свои
//  ActiveEffect, выдача Черт/Талантов/снаряжения — и уже есть общий рубильник
//  `isItemActive()` (module/apps/effects.mjs), которым живут снаряжённое оружие,
//  установленный имплант и включённая модификация брони. Подспособности
//  достаточно попасть в тот же рубильник, а не заводить второй.
//
//  Здесь — только решение «что должно стать включённым»: чистый расчёт на
//  голых данных, проверяемый без заглушки Foundry (правило проекта). Запись
//  флагов и пересборку эффектов делает module/apps/toggle-abilities.mjs.
// ════════════════════════════════════════════════════════════════════════════

const SYSTEM = "warhammer-dbc";

/** Флаги системы у предмета — и у живого документа, и у сырых данных пака. */
const flagsOf = (item) => item?.flags?.[SYSTEM] || {};

/**
 * Описание группы подспособностей или null, если предмет их не несёт.
 * Группа без заголовка бесполезна на листе, поэтому подставляем «Режимы».
 */
export function readToggleGroup(item) {
  const raw = flagsOf(item).toggleGroup;
  if (!raw || typeof raw !== "object") return null;
  return {
    label: String(raw.label || "Режимы"),
    mode: raw.mode === "many" ? "many" : "one"
  };
}

/** id предмета-родителя, если этот предмет — подспособность. */
export function toggleParentId(item) {
  const id = flagsOf(item).toggleOf;
  return id ? String(id) : "";
}

/** Включена ли подспособность. Не подспособность — вопрос не имеет смысла. */
export function isToggleOn(item) {
  return toggleParentId(item) ? !!flagsOf(item).toggleOn : false;
}

/**
 * Подспособности одного родителя в порядке предметов актора.
 * `items` — любой перебираемый список предметов (коллекция Foundry годится).
 */
export function childrenOf(items, parentId) {
  const want = String(parentId || "");
  if (!want) return [];
  return [...(items || [])].filter(i => toggleParentId(i) === want);
}

/**
 * Что должно стать включённым после нажатия кнопки. Возвращает список правок
 * `{ id, on }` ТОЛЬКО для тех подспособностей, чьё состояние меняется: писать
 * флаг соседу, который и так выключен, — лишняя правка документа и лишний
 * пересчёт листа.
 *
 * Режим "one" гасит соседей. Повторное нажатие по включённой — выключает её:
 * книга разрешает Герольду не проецировать Локус вовсе, а отдельная кнопка
 * «ни один» на листе была бы седьмой кнопкой ради пустого состояния.
 */
export function planToggle(group, siblings, targetId, want) {
  const id = String(targetId || "");
  if (!id) return [];
  const list = [...(siblings || [])];
  const target = list.find(i => String(i.id ?? i._id) === id);
  if (!target) return [];

  const on = want === undefined ? !isToggleOn(target) : !!want;
  const out = [];
  for (const item of list) {
    const itemId = String(item.id ?? item._id);
    // В режиме "one" включение цели гасит всех остальных; в "many" соседи
    // живут своей жизнью.
    const next = itemId === id ? on : (on && group?.mode !== "many" ? false : isToggleOn(item));
    if (next !== isToggleOn(item)) out.push({ id: itemId, on: next });
  }
  return out;
}

/**
 * Строки группы для листа: подспособности с их состоянием и подписью.
 * Лист рисует их вложенными под родителем — см. templates/actor/parts/
 * tab-abilities.hbs.
 */
export function toggleRows(items, parent) {
  const group = readToggleGroup(parent);
  if (!group) return null;
  const parentId = String(parent.id ?? parent._id);
  const rows = childrenOf(items, parentId).map(i => ({
    id: String(i.id ?? i._id),
    name: i.name,
    on: isToggleOn(i),
    hint: String(i.system?.benefit || i.system?.description || "")
  }));
  return { ...group, parentId, rows };
}

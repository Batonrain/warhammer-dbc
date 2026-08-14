// module/apps/compendium-filters.mjs
//
// Отбор предметов для режима выбора в Обозревателе компендиумов
// (module/apps/compendium-browser.mjs).
//
// Раньше сужение выдачи описывалось объектом с жёстко зашитым набором полей
// (weaponFolderId/weaponProp/armorType/maxAvailability), и каждое новое условие
// значило новую ветку в теле окна. Теперь условия — реестр: имя → чистая
// функция (предмет, значение) => boolean, ровно как предикаты правил
// (module/rules/predicates.mjs). Добавить условие = дописать строку сюда.
//
// Файл намеренно без обращений к Foundry: сам обозреватель без игры не
// запустить (Dialog, game.packs, хук на вкладке компендиумов), а отбор —
// можно, и он проверяется тестом без заглушки.
//
// «Предмет» здесь — узел дерева из buildPackTree, а не документ Foundry: в нём
// лежит то, что даёт индекс компендиума, без загрузки самих предметов.

export const ITEM_FILTERS = {
  /** Тип предмета: "faction" либо список ["weapon","ammo"]. */
  type: (it, want) => (Array.isArray(want) ? want : [want]).includes(it?.type),
  /** Папка компендиума — «Тип» оружия в этом проекте задаётся именно папкой. */
  folderId: (it, want) => it?.folderId === want,
  /** Свойство оружия по ключу (system.properties[].key). */
  weaponProp: (it, want) => (it?.properties || []).some(p => p?.key === want),
  /** Тип брони (system.armorType). */
  armorType: (it, want) => it?.armorType === want,
  /** Доступность не выше указанной. */
  maxAvailability: (it, want) => (Number(it?.availability) || 0) <= Number(want)
};

/**
 * Подходит ли предмет под ВСЕ условия сразу. Пустой набор условий пропускает
 * всё: «фильтров не задано» и «ничего не подходит» — разные вещи.
 *
 * Неизвестное имя условия — ошибка в консоль и «не подходит». Молча показать
 * всё подряд, как будто фильтра и не было, нельзя: опечатка в имени условия
 * тогда осталась бы незамеченной до жалобы игрока.
 */
export function matchesFilters(item, filters = {}) {
  return Object.entries(filters).every(([key, want]) => {
    if (want == null) return true;
    const fn = ITEM_FILTERS[key];
    if (!fn) {
      console.error(`Warhammer DBC | обозреватель: неизвестное условие отбора «${key}»`);
      return false;
    }
    return fn(item, want);
  });
}

/**
 * Приводит режим выбора к одному виду.
 *
 * Понимает и прежнюю плоскую форму (weaponFolderId/weaponProp/armorType/
 * maxAvailability) — её шлёт kind:"equipment" Конструктора, и переписывать
 * рабочий вызов ради формы записи не стоит.
 *
 * @returns {{pack:?string, filters:object, count:number, prompt:string}|null}
 */
export function normalizePick(pick) {
  if (!pick) return null;
  const filters = { ...(pick.filters || {}) };
  if (pick.weaponFolderId  != null) filters.folderId        = pick.weaponFolderId;
  if (pick.weaponProp      != null) filters.weaponProp      = pick.weaponProp;
  if (pick.armorType       != null) filters.armorType       = pick.armorType;
  if (pick.maxAvailability != null) filters.maxAvailability = pick.maxAvailability;
  return {
    pack:   pick.pack ?? null,
    filters,
    count:  Math.max(1, Number(pick.count) || 1),
    prompt: String(pick.prompt || "")
  };
}

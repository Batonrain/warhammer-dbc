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

import { normalizeBudget, BUDGET_COUNT } from "../rules/pick-budget.mjs";

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
  maxAvailability: (it, want) => (Number(it?.availability) || 0) <= Number(want),
  /** Ступень Таланта: «7 талантов 1 уровня» — это ступень, а не цена. */
  talentTier: (it, want) => Number(it?.tier) === Number(want),
  /** Пси-Рейтинг силы не выше указанного: у психосилы system.cost — цена в ПР. */
  maxPsyRating: (it, want) => (Number(it?.cost) || 0) <= Number(want)
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
 * Бюджет («сколько можно взять») приводится к общему виду тем же проходом:
 * штуками или опытом, см. rules/pick-budget.mjs. Прежняя форма `count: N`
 * остаётся и означает бюджет в штуках — переписывать рабочие вызовы незачем.
 *
 * @returns {{pack:?string, filters:object, count:number, budget:object, prompt:string}|null}
 */
export function normalizePick(pick) {
  if (!pick) return null;
  const filters = { ...(pick.filters || {}) };
  if (pick.weaponFolderId  != null) filters.folderId        = pick.weaponFolderId;
  if (pick.weaponProp      != null) filters.weaponProp      = pick.weaponProp;
  if (pick.armorType       != null) filters.armorType       = pick.armorType;
  if (pick.maxAvailability != null) filters.maxAvailability = pick.maxAvailability;
  const count  = Math.max(1, Number(pick.count) || 1);
  const budget = normalizeBudget(pick.budget ?? { mode: BUDGET_COUNT, value: count });
  return {
    pack:   pick.pack ?? null,
    filters,
    count,
    budget,
    prompt: String(pick.prompt || "")
  };
}

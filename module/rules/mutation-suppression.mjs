// module/rules/mutation-suppression.mjs
// ════════════════════════════════════════════════════════════════════════
//  Подавление ВСЕХ Мутаций/Даров актора разом (Pure Form/Чистая Форма,
//  wdbc-1rno: «1 час концентрации подавляет все мутации, теряя их эффекты,
//  ещё 1 час возвращает их»). Не удаление — временное ОТКЛЮЧЕНИЕ: та же
//  общая машина, что уже разводит включённые/выключенные подспособности
//  Локусов Герольдов (apps/toggle-abilities.mjs::syncToggleChild) — рубильник
//  isItemActive() (apps/effects.mjs, теперь знает и про
//  flags.warhammer-dbc.suppressed на type:"mutation") и та же цепочка
//  пересинхронизации (эффекты/свойства оружия/выданные Черты-Таланты/
//  выданные предметы). Ничего нового не изобретает — переиспользует уже
//  работающий toggle-конвейер, просто источник переключения другой.
//
//  Сами функции пересинхронизации приходят ПАРАМЕТРОМ (dependency injection),
//  а не через import: они экспортированы из apps/mechanics.mjs/apps/effects.mjs,
//  а apps/mechanics.mjs сам импортирует executeItemCode из apps/item-script.mjs
//  — если бы этот модуль импортировал apps/mechanics.mjs напрямую, а
//  item-script.mjs импортировал этот модуль (для script-контекста), возник бы
//  цикл item-script → mutation-suppression → mechanics → item-script. Вызывающая
//  сторона (apps/mechanics.mjs::runMechScriptEntry) передаёт свои же локальные
//  функции — новых импортов там не появляется вовсе.
// ════════════════════════════════════════════════════════════════════════

/**
 * Ставит/снимает флаг подавления на КАЖДОЙ Мутации/Даре актора, кроме
 * самого источника (sourceItem — обычно Pure Form: подавлять собственный
 * переключатель бессмысленно, вернуть эффекты будет нечем), и приводит их
 * выданное в соответствие — тот же порядок вызовов, что
 * apps/toggle-abilities.mjs::syncToggleChild.
 *
 * @param {Item} sourceItem  предмет-источник (Pure Form); actor = sourceItem.parent.
 * @param {boolean} suppressed
 * @param {{syncItemEffectsDisabled: Function, syncWeaponPropItemEffects: Function,
 *   syncGrantedAbilities: Function, syncGrantedEquipment: Function}} syncFns
 * @returns {Promise<string[]>} имена ЗАТРОНУТЫХ (реально сменивших состояние) Мутаций/Даров
 */
export async function setMutationsSuppressed(sourceItem, suppressed, syncFns) {
  const { syncItemEffectsDisabled, syncWeaponPropItemEffects, syncGrantedAbilities, syncGrantedEquipment } = syncFns;
  const actor = sourceItem?.parent;
  if (!actor) return [];
  const targets = (actor.items ?? []).filter(i => i.type === "mutation" && i.id !== sourceItem.id);
  const names = [];
  for (const item of targets) {
    const current = !!item.getFlag("warhammer-dbc", "suppressed");
    if (current === suppressed) continue;
    await item.setFlag("warhammer-dbc", "suppressed", suppressed);
    await syncItemEffectsDisabled(item);
    await syncWeaponPropItemEffects(item);
    await syncGrantedAbilities(item);
    await syncGrantedEquipment(item);
    names.push(item.name);
  }
  return names;
}

/** Подавлена ли прямо сейчас хоть одна Мутация/Дар актора (для UI/кнопки). */
export function anyMutationSuppressed(actor) {
  return (actor?.items ?? []).some(i => i.type === "mutation" && !!i.getFlag("warhammer-dbc", "suppressed"));
}

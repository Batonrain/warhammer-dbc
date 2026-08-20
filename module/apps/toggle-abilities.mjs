// module/apps/toggle-abilities.mjs
// ════════════════════════════════════════════════════════════════════════════
//  ПЕРЕКЛЮЧАЕМЫЕ ПОДСПОСОБНОСТИ — сторона Foundry.
//
//  Решение «что должно стать включённым» считает module/rules/toggle-abilities.mjs
//  на голых данных. Здесь — запись флагов и приведение механики в соответствие
//  с новым состоянием.
//
//  Ничего нового механика не изобретает: подспособность попадает в общий
//  рубильник isItemActive() (module/apps/effects.mjs), а дальше работают уже
//  написанные пересинхронизации —
//    syncItemEffectsDisabled   — ActiveEffect Конструктора (± Характеристика,
//                                Движение, Очки Брони, Вес, Очки Судьбы);
//    syncGrantedAbilities      — выданные Черты и Таланты;
//    syncGrantedEquipment      — выданные предметы и встроенные атаки;
//    syncWeaponPropItemEffects — Свойства оружия.
//  Записи-«живые запросы» (Трудный Ландшафт, Усталость, модификаторы бросков)
//  отдельного вызова не требуют: их читатели спрашивают Механику в момент
//  теста и обязаны сами считаться с активностью источника.
// ════════════════════════════════════════════════════════════════════════════

import { readToggleGroup, childrenOf, planToggle, toggleParentId } from "../rules/toggle-abilities.mjs";
import { syncItemEffectsDisabled } from "./effects.mjs";
import { syncGrantedAbilities, syncGrantedEquipment, syncWeaponPropItemEffects } from "./mechanics.mjs";

const SYSTEM = "warhammer-dbc";

/**
 * Приводит механику одной подспособности в соответствие с её состоянием.
 * Порядок важен: сперва эффекты (они мгновенны и дёшевы), потом выдачи —
 * создание и удаление embedded-предметов дёргает пересчёт листа, и делать это
 * до включения эффектов значило бы считать лист дважды по неполным данным.
 */
export async function syncToggleChild(item) {
  await syncItemEffectsDisabled(item);
  await syncWeaponPropItemEffects(item);
  await syncGrantedAbilities(item);
  await syncGrantedEquipment(item);
}

/**
 * Нажатие кнопки «вкл./выкл.» у подспособности. `want` не задан — переключить.
 * Возвращает список того, что реально поменялось (для журнала в чат).
 */
export async function toggleAbility(actor, parentId, childId, want) {
  const parent = actor?.items?.get(parentId);
  const group = readToggleGroup(parent);
  if (!group) return [];

  const siblings = childrenOf(actor.items, parentId);
  const plan = planToggle(group, siblings, childId, want);
  if (!plan.length) return [];

  // Одним update: две правки подряд дали бы два пересчёта листа и мигание.
  await actor.updateEmbeddedDocuments("Item", plan.map(p => ({
    _id: p.id, [`flags.${SYSTEM}.toggleOn`]: p.on
  })));

  // Пересинхронизация — уже по обновлённым документам, поэтому вторым проходом.
  for (const p of plan) {
    const child = actor.items.get(p.id);
    if (child) await syncToggleChild(child);
  }
  return plan;
}

/**
 * Подспособности, включённые у актора прямо сейчас. Нужна листу и всякому,
 * кто хочет показать «что сейчас включено» — например строке состояния в бою.
 */
export function activeToggles(actor) {
  return [...(actor?.items || [])].filter(i => toggleParentId(i) && i.getFlag(SYSTEM, "toggleOn"));
}

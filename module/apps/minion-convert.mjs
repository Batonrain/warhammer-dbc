// module/apps/minion-convert.mjs
//
// «Превратить в Миньона» из меню «Настройки листа» Персонажа, Демона и Принца
// Демонов (wdbc-v99a). Как и «В Орду» (apps/horde-convert.mjs) — делает ДУБЛЬ
// актора типа minion, а не меняет тип на месте: сменить тип у существующего
// документа Foundry не даёт, да и откатить такую правку было бы нечем.
//
// Переносить почти нечего пересчитывать: схема у всех четверых общая
// (creatureSchema, data/actor/_creature.mjs), поэтому system едет целиком —
// База/Продвижение характеристик, навыки, Раны, Состояния. Поля, которых у
// Миньона нет (опыт, Происхождение и т.п.), схема Миньона при создании
// отбрасывает сама. Предметы едут все: Миньон держит те же типы, что существо.
// Чего перенос НЕ делает: не привязывает к Хозяину — группу, силу и
// Талант-слот выбирают на листе Миньона, как у любого нового слуги.

import { esc } from "../helpers/utils.mjs";

/** Кто умеет становиться Миньоном: существа с общей схемой creatureSchema. */
export const MINION_CONVERTIBLE_TYPES = ["character", "daemon", "demonPrince"];

/**
 * Данные нового Миньона по сырому объекту актора (actor.toObject()). Чистая
 * функция — Foundry здесь не нужен.
 */
export function minionCreateDataFrom(src) {
  const system = foundry.utils.deepClone(src.system ?? {});
  system.isMinion = true;
  // Слот Таланта Хозяина у копии свой — прежний (если оригинал уже был чьим-то
  // слугой-Персонажем) принадлежит оригиналу.
  system.slotTalentId = "";
  return {
    name: src.name,
    type: "minion",
    img: src.img,
    system,
    flags: { "warhammer-dbc": { minionSource: { uuid: src.uuid ?? "", name: src.name, type: src.type } } }
  };
}

/** Создать Миньона из существа. Возвращает нового актора или null. */
export async function convertActorToMinion(actor) {
  if (!actor || !MINION_CONVERTIBLE_TYPES.includes(actor.type)) {
    ui.notifications.warn("Миньоном становится Персонаж, Демон или Принц Демонов.");
    return null;
  }
  const ok = await Dialog.confirm({
    title: "Превратить в Миньона",
    content: `<p>Создать <b>${esc(actor.name)}</b> — копию этого актора как Миньона?</p>
      <p>Характеристики, Навыки, Раны, Таланты, Черты и снаряжение переезжают как есть.</p>
      <p class="notes">Группу, силу и Хозяина выберите на листе Миньона. Оригинал останется на месте.</p>`,
    defaultYes: true
  });
  if (!ok) return null;

  const src = { ...actor.toObject(), uuid: actor.uuid };
  const minion = await Actor.create(minionCreateDataFrom(src));
  if (!minion) return null;
  const items = actor.items.map(i => i.toObject());
  // keepId: связи предметов держатся на id (installedOn модификаций и Вязей,
  // linkedWeapon имплантов); у нового актора коллизий id нет.
  if (items.length) await minion.createEmbeddedDocuments("Item", items, { keepId: true });

  ui.notifications.info(`Миньон «${minion.name}» создан, предметов перенесено ${items.length}.`);
  minion.sheet?.render(true);
  return minion;
}

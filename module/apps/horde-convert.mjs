// module/apps/horde-convert.mjs
//
// Кнопка «В Орду» на листах Персонажа, Демона и Принца Демонов: делает ДУБЛЬ
// актора Ордой. Оригинал не трогается — Орда это отдельный актор, а не смена
// типа на месте: сменить тип у существующего документа Foundry не даёт, да и
// откатить такую правку было бы нечем.
//
// Счётная часть — rules/horde-convert.mjs; здесь создание документа, копия
// предметов и разговор с пользователем.

import { hordeSystemFrom, hordeNameFrom, hordeItemsFrom,
         HORDE_KEPT_ITEM_TYPES } from "../rules/horde-convert.mjs";
import { RACES } from "../constants/races.mjs";
import { ITEM_TYPES } from "../constants/items.mjs";
import { esc } from "../helpers/utils.mjs";

/** Существа, которые умеют становиться Ордой: у всех троих одна схема. */
export const HORDE_CONVERTIBLE_TYPES = ["character", "daemon", "demonPrince"];

/**
 * Обработчик кнопки «В Орду». Живёт здесь, а не в листе Персонажа: кнопка есть
 * и у Демона, и у Принца, а ApplicationV2 сверяет карту действий с разметкой у
 * каждого класса своей — унаследованное объявление в неё не попадает.
 */
export function onConvertToHorde(event) {
  event.preventDefault();
  return convertActorToHorde(this.actor);
}

/** Подписи для шапки Орды: вид существа и краткое описание. */
function metaOf(actor) {
  const s = actor.system || {};
  return {
    speciesName: RACES[s.race]?.label || s.race || "",
    faction:     s.faction || "",
    descriptor:  [s.archetype, s.eliteArchetype].filter(Boolean).join(" · ")
  };
}

/**
 * Создать Орду из существа. Возвращает нового актора или null, если отказались.
 */
export async function convertActorToHorde(actor) {
  if (!actor || !HORDE_CONVERTIBLE_TYPES.includes(actor.type)) {
    ui.notifications.warn("Ордой становится Персонаж, Демон или Принц Демонов.");
    return null;
  }

  const items   = actor.items.map(i => i.toObject());
  const kept    = hordeItemsFrom(items);
  const dropped = items.length - kept.length;
  const name    = hordeNameFrom(actor.name);
  const start   = Math.max(0, Number(actor.system.wounds?.max) || 0);

  const droppedNote = dropped
    ? `<p class="notes">Не переедут: ${dropped} предм. (${
        [...new Set(items.filter(i => !HORDE_KEPT_ITEM_TYPES.includes(i.type))
          .map(i => ITEM_TYPES[i.type] || i.type))].join(", ")}) — у Орды их некуда положить.</p>`
    : "";

  const ok = await Dialog.confirm({
    title: "Конвертировать в Орду",
    content: `<p>Создать <b>${esc(name)}</b> — копию этого существа как Орды?</p>
      <p>Характеристики, Навыки, Таланты, Черты и снаряжение переезжают.
         Раны становятся Магнитудой: <b>${start}</b>.</p>
      ${droppedNote}
      <p class="notes">Оригинал останется на месте.</p>`,
    defaultYes: true
  });
  if (!ok) return null;

  const horde = await Actor.create({
    name, type: "horde", img: actor.img,
    system: hordeSystemFrom(actor.system, items, metaOf(actor)),
    // Откуда родом эта Орда — чтобы потом было видно, из кого её сделали.
    flags: { "warhammer-dbc": { hordeSource: { uuid: actor.uuid, name: actor.name } } }
  });
  if (!horde) return null;

  if (kept.length) await horde.createEmbeddedDocuments("Item", kept);

  ui.notifications.info(
    `Орда «${horde.name}» создана: Магнитуда ${start}, предметов перенесено ${kept.length}.`);
  horde.sheet?.render(true);
  return horde;
}

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
         actorSystemFromHorde, actorNameFromHorde,
         HORDE_KEPT_ITEM_TYPES } from "../rules/horde-convert.mjs";
import { RACES } from "../constants/races.mjs";
import { ITEM_TYPES } from "../constants/items.mjs";
import { esc } from "../helpers/utils.mjs";

/** Существа, которые умеют становиться Ордой: схема у всех четверых общая (creatureSchema). */
export const HORDE_CONVERTIBLE_TYPES = ["character", "daemon", "demonPrince", "minion"];


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
    ui.notifications.warn("Ордой становится Персонаж, Демон, Принц Демонов или Миньон.");
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

/**
 * «В Персонажа» из меню «Настройки листа» на листе Орды — обратное
 * превращение. Спрашивает, во что: Персонажа или Демона (Орда сама не хранит,
 * из кого её сделали, кроме заметки в hordeSource — тип поэтому спрашиваем).
 * Настоящего отката нет — см. предупреждение в диалоге и комментарий у
 * actorSystemFromHorde: часть данных (База/Продвижение по отдельности, цена
 * навыков в опыте, Раса/Архетип как ключи, Броня по зонам) Орда уже не хранит
 * и восстановить их неоткуда — то немногое, что можно, уходит в Заметки
 * текстом, а не молча теряется.
 */
export async function convertHordeToActor(horde) {
  if (!horde || horde.type !== "horde") return null;

  const targetType = await foundry.applications.api.DialogV2.wait({
    window: { title: "В Персонажа" },
    classes: ["warhammer-dbc", "wh-holo"],
    content: `<p>Во что превратить эту Орду?</p>`,
    buttons: [
      { action: "character", label: "Персонаж", default: true },
      { action: "daemon", label: "Демон" },
      { action: "cancel", label: "Отмена" }
    ],
    rejectClose: false
  });
  if (!targetType || targetType === "cancel") return null;

  const items = horde.items.map(i => i.toObject());
  const kept  = hordeItemsFrom(items);
  const name  = actorNameFromHorde(horde.name);

  const ok = await Dialog.confirm({
    title: "Конвертировать в Персонажа/Демона",
    content: `<p>Создать <b>${esc(name)}</b> — обратное превращение Орды?</p>
      <p>Переезжают: Раны (из Магнитуды), Ранг навыков, Групповые навыки, Размер,
         снаряжение/Таланты/Черты-предметы.</p>
      <p class="notes">НЕ переезжают структурно (только текстом в Заметки —
         ничего не теряется молча, но расставить придётся руками): разбивка
         характеристик База/Продвижение/Сверхъестественное (Орда хранила одно
         Итого), цена навыков в опыте, Раса/Архетип/Фракция как выбор в шапке
         (у Персонажа/Демона это предметы и ключи, а не свободная строка),
         Броня по зонам (Поглощение Орды — одно число с уже вложенным бонусом
         Стойкости, писать его в Броню напрямую задвоило бы Стойкость).</p>
      <p class="notes">Орда останется на месте.</p>`,
    defaultYes: true
  });
  if (!ok) return null;

  const actor = await Actor.create({
    name, type: targetType, img: horde.img,
    system: actorSystemFromHorde(horde.system),
    flags: { "warhammer-dbc": { hordeReverseSource: { uuid: horde.uuid, name: horde.name } } }
  });
  if (!actor) return null;

  if (kept.length) await actor.createEmbeddedDocuments("Item", kept);

  ui.notifications.info(
    `«${actor.name}» создан из Орды: предметов перенесено ${kept.length}. Расставьте Расу/Архетип/Броню вручную (см. Заметки).`);
  actor.sheet?.render(true);
  return actor;
}

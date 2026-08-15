// module/apps/actor-factions.mjs
// ════════════════════════════════════════════════════════════════════════
//  Поле «Фракция» в шапке листа — общее для всех типов акторов.
//
//  Принадлежность хранится обычным предметом типа `faction` на листе, а не
//  полем в схеме: так актор может состоять сразу в нескольких силах
//  (астартес-предатель — и Хаос, и свой легион), а правила читают её одним
//  и тем же actorFactionKeys() у любого типа актора. Поле в шапке — только
//  показ и два способа добавить: перетаскиванием и кнопкой «＋»,
//  открывающей Обозреватель компендиумов с фильтром на Фракции.
//
//  Разбор дерева сюда не заезжает: цепочка предков считается чистыми
//  функциями реестра (module/rules/factions.mjs), здесь остаётся Foundry —
//  создание предмета, удаление и диалог выбора.
// ════════════════════════════════════════════════════════════════════════

import { factionKey, factionChain, getFactionIndex } from "../rules/factions.mjs";
import { openCompendiumBrowser } from "./compendium-browser.mjs";
import { ITEM_TYPES } from "../constants/items.mjs";

/** Подпись фракции по ключу: из каталога, а без него — сам ключ. */
function labelForKey(key, byKey) {
  return byKey.get(key)?.name || key;
}

/**
 * Путь от корня: «Хаос → Легионы-предатели → Несущие Слово». Идёт в подсказку
 * фишки — по одному названию не видно, частью чего фракция является, а именно
 * это и решает, сработает ли правило.
 */
function chainLabel(key) {
  const byKey = getFactionIndex();
  const chain = factionChain(key, byKey);
  if (chain.length < 2) return "";
  return chain.slice().reverse().map(k => labelForKey(k, byKey)).join(" → ");
}

/** Фракции актора для шапки листа. */
export function actorFactionsContext(actor) {
  return {
    actorFactions: [...(actor?.items ?? [])]
      .filter(i => i?.type === "faction")
      .map(item => {
        const key = factionKey(item);
        return {
          id: item.id, key, name: item.name, img: item.img,
          // Подсказка объясняет фишку целиком: путь по дереву либо, если
          // каталог ещё не собран, хотя бы ключ.
          hint: chainLabel(key) || key || item.name
        };
      })
  };
}

/** Уже состоит ли актор в этой фракции. Сравнение по ключу, а не по имени. */
function alreadyMember(actor, key) {
  return [...(actor?.items ?? [])].some(i => i.type === "faction" && factionKey(i) === key);
}

/**
 * Добавить фракцию актору. Общая часть для дропа и кнопки «＋»: обе получают
 * документ-источник и должны одинаково отсеять повтор и чужой тип.
 */
async function addFaction(actor, src) {
  if (!src) return;
  if (src.type !== "faction") {
    return ui.notifications.warn(
      `Сюда нужно перетащить Фракцию, а перетащено: ${ITEM_TYPES[src.type] || src.type}.`);
  }
  const key = factionKey(src);
  if (key && alreadyMember(actor, key)) {
    return ui.notifications.info(`${actor.name} уже состоит во фракции «${src.name}».`);
  }
  const data = src.toObject();
  delete data._id;
  await actor.createEmbeddedDocuments("Item", [data]);
}

/**
 * Обработчики поля. Вызывается из activateListeners каждого листа актора —
 * шапки у листов свои, а поведение поля одно.
 */
export function activateFactionFieldListeners(html, actor) {
  const zone = html.find(".faction-drop-zone")[0];
  if (zone) {
    zone.addEventListener("dragover", ev => {
      ev.preventDefault();
      zone.classList.add("faction-drop-over");
    });
    zone.addEventListener("dragleave", () => zone.classList.remove("faction-drop-over"));
    zone.addEventListener("drop", async ev => {
      zone.classList.remove("faction-drop-over");
      if (!actor.isOwner) return;
      const data = foundry.applications.ux.TextEditor.implementation.getDragEventData(ev);
      if (data?.type !== "Item") return;
      // Дальше лист не пускаем: его собственный обработчик дропа создал бы
      // предмет второй раз, уже без проверки на повтор.
      ev.preventDefault();
      ev.stopPropagation();
      await addFaction(actor, await Item.implementation.fromDropData(data));
    });
  }

  html.find(".wh-faction-add").on("click", async ev => {
    ev.preventDefault();
    if (!actor.isOwner) return;
    const uuid = await openCompendiumBrowser(false, {
      filters: { type: "faction" },
      prompt: "Выберите фракцию — принадлежность считается и ко всем вышестоящим"
    });
    if (!uuid) return;
    const doc = await fromUuid(uuid).catch(() => null);
    if (!doc) return ui.notifications.warn("Фракция не найдена — возможно, компендиум изменился.");
    await addFaction(actor, doc);
  });

  html.find(".wh-faction-remove").on("click", async ev => {
    ev.preventDefault();
    if (!actor.isOwner) return;
    const id = ev.currentTarget.dataset.itemId;
    if (id) await actor.deleteEmbeddedDocuments("Item", [id]);
  });
}

// module/apps/faction-roster.mjs
// ════════════════════════════════════════════════════════════════════════
//  Вкладка «СОСТАВ» на листе Фракции — кто ей принадлежит.
//
//  Список НИГДЕ не хранится: он считается по тем же данным, что и сама
//  принадлежность. Актор состоит во фракции, когда на нём лежит её предмет
//  (module/apps/actor-factions.mjs), а нижестоящая фракция — когда её
//  `parentKey` указывает сюда. Поэтому вкладка не заводит своего списка: две
//  записи об одной связи неминуемо разъезжаются, а «Состав» и поле «Фракция»
//  в шапке актора обязаны показывать одно и то же.
//
//  Перетаскивание работает в обратную сторону: бросить актора в блок —
//  выдать ему предмет фракции, бросить фракцию — переставить её `parentKey`.
//
//  Чистая часть (какие блоки бывают и кто в какой попадает) отделена от
//  Foundry и проверяется тестом.
// ════════════════════════════════════════════════════════════════════════

import { factionKey, factionChildren, factionServants, factionChain,
         factionAncestors, getFactionIndex } from "../rules/factions.mjs";
import { packActors } from "./faction-cache.mjs";

/**
 * Блоки состава. Порядок — от людей к владениям, как в книге читается сверху
 * вниз. `types` — типы акторов блока; `faction: true` у единственного блока,
 * который собирает не акторов, а нижестоящие фракции.
 */
export const ROSTER_BLOCKS = [
  { key: "lights",   label: "Светочи",        types: ["character", "daemon", "demonPrince"] },
  { key: "vassals",  label: "Вассалы",        faction: true },
  // Служащие — обратная сторона «Также состоит в»: по устройству они часть
  // другой силы, а сюда входят службой. Перетаскиванием не заполняется:
  // сторону связи задаёт сама служащая фракция на своём листе.
  { key: "servants", label: "Служат",         faction: true, readonly: true },
  { key: "troops",   label: "Войска",         types: ["squad", "formation", "horde"] },
  { key: "garage",   label: "Гараж и ангары", types: ["vehicle"] },
  { key: "fleet",    label: "Флот",           types: ["ship"] },
  { key: "domains",  label: "Владения",       types: ["starSystem"] }
];

/** Блок, которому принадлежит тип актора; null — такой тип в состав не идёт. */
export function blockForActorType(type) {
  return ROSTER_BLOCKS.find(b => (b.types || []).includes(type)) || null;
}

/** Предмет-фракция с этим ключом на акторе — он и есть запись о принадлежности. */
export function factionItemOf(actor, key) {
  return [...(actor?.items ?? [])].find(i => i?.type === "faction" && factionKey(i) === key) || null;
}

/**
 * Разложить акторов по блокам состава. Актор попадает в блок, когда на нём
 * лежит предмет этой фракции; типы, не описанные ни одним блоком (например
 * будущие), просто не показываются — молчаливо, потому что это не ошибка.
 */
export function groupRoster(key, actors = [], children = [], labelForType = t => t, servants = []) {
  const want = String(key ?? "").trim();
  const byBlock = Object.fromEntries(ROSTER_BLOCKS.map(b => [b.key, []]));
  if (!want) return byBlock;

  for (const actor of actors) {
    const item = factionItemOf(actor, want);
    if (!item) continue;
    const block = blockForActorType(actor.type);
    if (!block) continue;
    byBlock[block.key].push({
      uuid: actor.uuid, name: actor.name, img: actor.img,
      type: actor.type, typeLabel: labelForType(actor.type),
      itemId: item.id,
      // Актор из компендиума — заготовка, а не игровой персонаж: помечаем,
      // чтобы одноимённые не путались.
      inPack: !!actor.pack
    });
  }

  const asFaction = f => ({
    uuid: f.uuid, name: f.name, img: f.img,
    type: "faction", typeLabel: "Фракция", key: factionKey(f)
  });
  byBlock.vassals  = children.map(asFaction);
  byBlock.servants = servants.map(asFaction);

  for (const list of Object.values(byBlock))
    list.sort((a, b) => String(a.name).localeCompare(String(b.name), "ru"));
  return byBlock;
}

/**
 * Контекст вкладки «Состав».
 *
 * Асинхронный, потому что акторы компендиумов приходят загрузкой документов:
 * принадлежность лежит ПРЕДМЕТОМ на акторе, а предметы в индекс пака не
 * попадают. Загрузка кэшируется (apps/faction-cache.mjs), поэтому повторные
 * перерисовки листа ничего не стоят.
 */
export async function factionRosterContext(item) {
  const key = factionKey(item);
  const fromPacks = await packActors().catch(() => []);
  // Мировой актор важнее одноимённого компендиумного: играют им, а не
  // заготовкой. Сравниваем по uuid — у копии из пака он всегда свой.
  const seen = new Set([...(game.actors ?? [])].map(a => a.uuid));
  const index = getFactionIndex();
  const byBlock = groupRoster(
    key,
    [...(game.actors ?? []), ...fromPacks.filter(a => !seen.has(a.uuid))],
    factionChildren(key, index),
    type => game.i18n.localize(`TYPES.Actor.${type}`),
    factionServants(key, index)
  );

  const HINTS = {
    vassals:  "Фракции, входящие в состав этой",
    servants: "Служат этой, входя по устройству в другую"
  };
  return {
    factionHasKey: !!key,
    factionRoster: ROSTER_BLOCKS.map(block => ({
      key: block.key,
      label: block.label,
      // Подсказка перечисляет, что сюда кладут: у блоков акторов — подписи
      // типов, у фракционных — своя.
      hint: block.faction ? HINTS[block.key]
        : block.types.map(t => game.i18n.localize(`TYPES.Actor.${t}`)).join(", "),
      isFaction: !!block.faction,
      readonly: !!block.readonly,
      members: byBlock[block.key]
    }))
  };
}

/** Есть ли уже такой актор в составе — сравнение по ключу фракции. */
async function addActorToFaction(item, actor) {
  const key = factionKey(item);
  if (!key) return ui.notifications.warn("У фракции нет ключа — принадлежность не на что ссылаться.");
  if (!blockForActorType(actor.type)) {
    return ui.notifications.warn(`${actor.name}: тип «${game.i18n.localize(`TYPES.Actor.${actor.type}`)}» в состав фракции не входит.`);
  }
  if (factionItemOf(actor, key)) {
    return ui.notifications.info(`${actor.name} уже состоит во фракции «${item.name}».`);
  }
  if (!actor.isOwner) return ui.notifications.warn(`Нет прав на «${actor.name}».`);
  const data = item.toObject();
  delete data._id;
  await actor.createEmbeddedDocuments("Item", [data]);
}

/** Перестановка нижестоящей фракции: её `parentKey` начинает указывать сюда. */
async function addChildFaction(item, child) {
  const key = factionKey(item);
  const childKey = factionKey(child);
  if (!key) return ui.notifications.warn("У фракции нет ключа — вассалы ссылаться не на что.");
  if (!childKey) return ui.notifications.warn(`У фракции «${child.name}» нет ключа.`);
  if (childKey === key) return ui.notifications.warn("Фракция не может входить в саму себя.");
  // Кольцо: нельзя сделать вассалом того, кому сам подчиняешься — ни по
  // дереву, ни дополнительной принадлежностью.
  if (factionAncestors(key, getFactionIndex()).has(childKey)) {
    return ui.notifications.warn(`Эта фракция сама входит в «${child.name}» — кольца в дереве не бывает.`);
  }
  await child.update({ "system.parentKey": key });
}

// ── Древо происхождения ─────────────────────────────────────────────────────
//
// Цепочка вверх до корня, нарисованная лесенкой. Ветвление вниз сюда не
// заезжает: у фракции ровно один родитель, и «происхождение» — это путь, а не
// куст. Отключённый узел остаётся в данных и в цепочке правил — гаснет только
// на схеме, чтобы длинную ветку можно было читать по частям.

/** Флаг предмета со списком ключей, спрятанных на схеме. */
export const TREE_HIDDEN_FLAG = "originTreeHidden";

const hiddenKeys = item => new Set(item?.getFlag?.("warhammer-dbc", TREE_HIDDEN_FLAG) ?? []);

/**
 * Узлы схемы от корня к текущей фракции. Первый узел — корень, последний —
 * сама фракция; её отключить нельзя, иначе схема потеряла бы точку отсчёта.
 */
export function originTreeContext(item) {
  const byKey = getFactionIndex();
  const key = factionKey(item);
  const chain = factionChain(key, byKey);
  const hidden = hiddenKeys(item);

  // Цепочка идёт от себя к корню — на схеме привычнее сверху вниз от корня.
  const nodes = chain.slice().reverse().map((k, i) => {
    const doc = byKey.get(k);
    return {
      key: k,
      name: doc?.name || k,
      img: doc?.img || "",
      uuid: doc?.uuid || "",
      depth: i,
      isSelf: k === key,
      hidden: hidden.has(k)
    };
  });

  return {
    // Одинокая фракция — тоже цепочка из одного узла, но схему из неё рисовать
    // нечего: показываем подсказку вместо пустой лесенки.
    originTree: nodes.length > 1 ? nodes : [],
    originTreeSolo: nodes.length <= 1,
    originTreeOpen: !!item?.sheet?._originTreeOpen
  };
}

/** Обработчики схемы происхождения. */
export function activateOriginTreeListeners(html, item) {
  // Свёрнутость — состояние окна, а не предмета: у каждого мастера своё.
  html.find(".faction-origin-tree").on("toggle", ev => {
    if (item?.sheet) item.sheet._originTreeOpen = ev.currentTarget.open;
  });

  html.find(".origin-node-open").on("click", async ev => {
    ev.preventDefault();
    const uuid = ev.currentTarget.closest("[data-uuid]")?.dataset.uuid;
    if (!uuid) return ui.notifications.warn("Эта фракция не найдена в каталоге — открывать нечего.");
    const doc = await fromUuid(uuid).catch(() => null);
    doc?.sheet?.render(true);
  });

  html.find(".origin-node-toggle").on("click", async ev => {
    ev.preventDefault();
    const key = ev.currentTarget.closest("[data-key]")?.dataset.key;
    if (!key) return;
    const hidden = hiddenKeys(item);
    if (hidden.has(key)) hidden.delete(key); else hidden.add(key);
    await item.setFlag("warhammer-dbc", TREE_HIDDEN_FLAG, [...hidden]);
  });
}

/** Обработчики вкладки. Item здесь — сама Фракция, чей лист открыт. */
export function activateFactionRosterListeners(html, item) {
  html.find(".faction-roster-zone").each((_, zone) => {
    zone.addEventListener("dragover", ev => {
      ev.preventDefault();
      zone.classList.add("sq-drop-hover");
    });
    zone.addEventListener("dragleave", () => zone.classList.remove("sq-drop-hover"));
    zone.addEventListener("drop", async ev => {
      zone.classList.remove("sq-drop-hover");
      const data = foundry.applications.ux.TextEditor.implementation.getDragEventData(ev);
      if (!data?.type) return;
      ev.preventDefault();
      ev.stopPropagation();
      if (!game.user.isGM && !item.isOwner) return;

      if (data.type === "Actor") {
        const actor = await Actor.implementation.fromDropData(data);
        if (actor) await addActorToFaction(item, actor);
        return;
      }
      if (data.type === "Item") {
        const doc = await Item.implementation.fromDropData(data);
        if (!doc) return;
        if (doc.type !== "faction") {
          return ui.notifications.warn("В состав кладут акторов, а фракцию — только в блок «Вассалы».");
        }
        await addChildFaction(item, doc);
      }
    });
  });

  html.find(".faction-roster-open").on("click", async ev => {
    ev.preventDefault();
    const uuid = ev.currentTarget.closest("[data-uuid]")?.dataset.uuid;
    const doc = uuid ? await fromUuid(uuid).catch(() => null) : null;
    doc?.sheet?.render(true);
  });

  html.find(".faction-roster-remove").on("click", async ev => {
    ev.preventDefault();
    const row = ev.currentTarget.closest("[data-uuid]");
    const doc = await fromUuid(row?.dataset.uuid).catch(() => null);
    if (!doc) return;
    // У актора снимаем предмет-принадлежность, у вассала — гасим ссылку вверх.
    if (doc instanceof Actor) {
      const id = row.dataset.itemId;
      if (id) await doc.deleteEmbeddedDocuments("Item", [id]);
    } else {
      await doc.update({ "system.parentKey": "" });
    }
  });
}

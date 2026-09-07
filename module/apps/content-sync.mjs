// module/apps/content-sync.mjs
// ════════════════════════════════════════════════════════════════════════════
//  «Обновить мир» — сверка предметов на актёрах с текущими данными пака и
//  выборочное применение изменений (кнопка в системных Настройках).
//
//  Сопоставление: сперва _stats.compendiumSource, затем имя (двуязычное
//  «A / Б» матчится целиком и любой половиной) — приём, уже используемый в
//  module/migrations/ship-hulls.mjs и tech-power-costs.mjs, здесь обобщён на
//  все типы предметов сразу.
//
//  Диффинг — трёхсторонний per-field, БЕЗ жёсткого списка «эти поля можно
//  трогать» по типу предмета (см. doombc-race-def-field-whitelist — ловушка
//  ручных списков полей). У каждого поля своя опорная точка —
//  flags.warhammer-dbc.contentSync.baseline.<path>: значение system.<path> на
//  момент, когда его в последний раз явно приняли из пака (или, если поля там
//  ещё нет, — просто текущее значение на предмете: считаем его «уже
//  актуальным», пока пак не докажет обратное). Поле:
//    • пак не менял относительно опоры            → не показываем вовсе;
//    • пак поменял, актёр не менял (== опоре)      → "clean", применимо;
//    • пак поменял И актёр поменял (оба ≠ опоре)   → "conflict", решает ГМ.
//  Такая опора на поле, а не на целый предмет, автоматически воспроизводит
//  уже существующее правило из tech-power-costs.mjs («цена, правленная
//  руками, не трогается») для абсолютно любого поля любого из 41 типа, без
//  отдельного спецкейса — и самовосстанавливается для предметов, попавших на
//  актёра позже: у них опоры ещё нет, так что первое расхождение с паком
//  тоже безопасно считается «чистым».
//
//  Область — только предметы актёров (game.actors → actor.items), включая
//  выданные автоматически (flags.warhammer-dbc.grantedByItem): их содержимое
//  не обновляет никто — syncGrantedEquipment/syncGrantedAbilities
//  (module/apps/mechanics.mjs) при существующей записи её просто пропускают.
// ════════════════════════════════════════════════════════════════════════════

import { ITEM_TYPES } from "../constants/items.mjs";

const FLAG = "warhammer-dbc";
const BASELINE_PATH = "contentSync.baseline";

// ────────────────────────────────────────────────────────────────────────────
//  Механика Конструктора (wdbc-lddr) участвует в сверке НАРАВНЕ с полями
//  system — как отдельное виртуальное «поле».
//
//  Почему это понадобилось. Механика предмета живёт не в system, а во
//  flags.warhammer-dbc.mechanics, и сверка её не видела вовсе. У персонажа,
//  созданного ДО правки пака, Талант обновлял ОПИСАНИЕ (system.notes в сверку
//  входит) и не получал самой механики: на листе было написано, что работает,
//  а работать было нечему. Хуже, чем «не работает», — текст врал.
//
//  Почему безопасно. Механика получает свою опору, как и любое поле: правка,
//  сделанная ГМом на конкретном предмете актёра, расходится с опорой и уходит
//  в «конфликт» (решает ГМ), а не затирается паком молча. Опора лежит
//  отдельным флагом, а не ключом внутри baseline: baseline — это снимок
//  system целиком (см. migrations/content-sync-baseline.mjs), и подмешивать
//  туда не-system значение значило бы сломать его смысл.
// ────────────────────────────────────────────────────────────────────────────

/** Виртуальный путь «поля» Механики. «@» не встречается в ключах system. */
export const MECH_PATH = "@mechanics";
const MECH_BASELINE_PATH = "contentSync.mechanicsBaseline";

// ────────────────────────────────────────────────────────────────────────────
//  ActiveEffect предмета (wdbc-9aj9) — третье виртуальное «поле», наравне с
//  system и Механикой.
//
//  Почему понадобилось. Сверка сравнивала только system.* и Механику, а
//  встроенную коллекцию эффектов не смотрела вовсе — и любая поломка, осевшая
//  в эффекте, «Обновить мир» не лечила и даже не показывала: окно рапортовало,
//  что расхождений нет. Так вышло с Боевыми Латами Скитарии: одноразовая
//  миграция (module/migrations/item-effects.mjs) перенесла очки брони в
//  ActiveEffect на предмете, пак потом починили, у нового персонажа всё верно,
//  а у старого броня по-прежнему задваивалась — 12/14/12/10 вместо 6/7/5/5.
//
//  ЧТО СРАВНИВАЕТСЯ, а что нет. Только содержательная часть эффекта: имя,
//  changes, перенос на актора и статусы. Остальное — состояние конкретной
//  копии, и сравнивать его значило бы завалить окно ложными строками:
//    • `disabled` ведёт syncItemEffectsDisabled (module/apps/effects.mjs) по
//      надетости предмета — у снятого предмета он всегда разойдётся с паком;
//    • `_id`, `origin`, `_stats`, `sort` уникальны для копии;
//    • эффекты с флагом `mechEntry` ведёт сам Конструктор
//      (syncMechanicsEffects) — их в паке может не быть вовсе, и трогать их
//      отсюда значило бы драться с ним за одну и ту же коллекцию.
// ────────────────────────────────────────────────────────────────────────────

/** Виртуальный путь «поля» эффектов предмета. */
export const EFFECTS_PATH = "@effects";
const EFFECTS_BASELINE_PATH = "contentSync.effectsBaseline";

/** Список эффектов документа: настоящая коллекция Foundry или простой массив. */
function effectDocs(doc) {
  const raw = doc?.effects;
  return Array.isArray(raw) ? raw : (raw?.contents ?? []);
}

/** Флаг эффекта — у документа Foundry он за getFlag, у слепка пака в data. */
function effectFlag(fx, key) {
  return fx?.getFlag?.(FLAG, key) ?? fx?.flags?.[FLAG]?.[key];
}

/** Одна правка эффекта без служебных полей. */
function normalizeChange(c) {
  return {
    key: String(c?.key ?? ""),
    type: String(c?.type ?? c?.mode ?? ""),
    value: c?.value ?? "",
    phase: String(c?.phase ?? ""),
    priority: Number(c?.priority) || 0
  };
}

/**
 * Содержательный слепок эффектов документа — то, что вообще имеет смысл
 * сверять с паком. Порядок эффектов в коллекции не значим (он зависит от
 * порядка создания копии), поэтому список сортируется по имени.
 */
export function effectsOf(doc) {
  return effectDocs(doc)
    .filter(fx => !effectFlag(fx, "mechEntry"))
    .map(fx => ({
      name: String(fx?.name ?? ""),
      transfer: fx?.transfer !== false,
      statuses: [...(fx?.statuses ?? [])].map(String).sort(),
      changes: (fx?.system?.changes ?? fx?.changes ?? []).map(normalizeChange)
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "ru"));
}

/** Механика документа (предмета актёра или документа пака) — всегда массив. */
function mechanicsOf(doc) {
  const arr = doc?.flags?.[FLAG]?.mechanics;
  return Array.isArray(arr) ? arr : [];
}

/** Подпись поля для окна: у виртуального поля Механики она человеческая. */
export function fieldLabel(path) {
  if (path === MECH_PATH)    return "МЕХАНИКА (Конструктор)";
  if (path === EFFECTS_PATH) return "Эффекты предмета (ActiveEffect)";
  return path;
}

/**
 * Значение поля для показа в окне. Механика — дерево групп и записей, её JSON
 * занял бы весь экран и ничего бы не сказал: показываем сводку по записям.
 */
export function describeValue(path, value) {
  if (path === EFFECTS_PATH) return describeEffects(value);
  if (path !== MECH_PATH) return null;
  const groups = Array.isArray(value) ? value : [];
  const labels = [];
  const walk = entries => {
    for (const e of entries || []) {
      if (e?.kind === "group") walk(e.group?.entries);
      else if (e) labels.push(String(e.label || e.kind || "запись"));
    }
  };
  for (const g of groups) walk(g.entries);
  if (!labels.length) return "—";
  const head = labels.slice(0, 4).join(", ");
  return labels.length > 4
    ? `${labels.length} записей: ${head}…`
    : `${labels.length} ${labels.length === 1 ? "запись" : "записи"}: ${head}`;
}

/**
 * Эффекты для окна: имя эффекта и что именно он правит. Полный JSON занял бы
 * весь экран, а важно ровно одно — какие поля меняются и на сколько.
 */
function describeEffects(value) {
  const list = Array.isArray(value) ? value : [];
  if (!list.length) return "—";
  return list.map(fx => {
    const what = (fx.changes || [])
      .map(c => `${c.key} ${c.type === "add" ? "+" : ""}${c.value}`)
      .join(", ");
    return `${fx.name}${what ? ` (${what})` : ""}`;
  }).join("; ");
}

/**
 * Ключи для поиска по имени: полное имя + обе половины двуязычного "A / Б" —
 * без учёта регистра, как в matchHullDoc (module/migrations/ship-hulls.mjs).
 */
export function nameKeys(name) {
  const n = String(name || "").trim().toLowerCase();
  if (!n) return [];
  const keys = new Set([n]);
  for (const part of n.split("/").map(s => s.trim()).filter(Boolean)) keys.add(part);
  return [...keys];
}

/** Глубокое сравнение значений поля (примитив/массив/plain-object). */
export function sameValue(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b || a == null || b == null) return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((v, i) => sameValue(v, b[i]));
  }
  if (typeof a === "object") {
    const ak = Object.keys(a), bk = Object.keys(b);
    if (ak.length !== bk.length) return false;
    return ak.every(k => Object.prototype.hasOwnProperty.call(b, k) && sameValue(a[k], b[k]));
  }
  return false;
}

/** Индекс документов пака: по uuid и по "type::имя" (для отката по имени). */
export function buildPackIndex(docs) {
  const byUuid = new Map();
  const byTypeName = new Map();
  for (const doc of docs) {
    if (!doc?.uuid) continue;
    byUuid.set(doc.uuid, doc);
    for (const key of nameKeys(doc.name)) byTypeName.set(`${doc.type}::${key}`, doc);
  }
  return { byUuid, byTypeName };
}

/** Документ пака для предмета актёра: сперва compendiumSource, затем имя того же типа. */
export function matchPackSource(item, index) {
  const src = item._stats?.compendiumSource;
  if (src && index.byUuid.has(src)) return index.byUuid.get(src);
  for (const key of nameKeys(item.name)) {
    const doc = index.byTypeName.get(`${item.type}::${key}`);
    if (doc) return doc;
  }
  return null;
}

/** Снимок-опора для конкретного поля: сохранённый флаг либо (если его ещё нет) текущее значение на предмете. */
function baselineFor(item, path) {
  if (path === MECH_PATH) {
    const stored = item.flags?.[FLAG]?.contentSync?.mechanicsBaseline;
    return Array.isArray(stored) ? stored : mechanicsOf(item);
  }
  if (path === EFFECTS_PATH) {
    const stored = item.flags?.[FLAG]?.contentSync?.effectsBaseline;
    return Array.isArray(stored) ? stored : effectsOf(item);
  }

  const stored = item.flags?.[FLAG]?.contentSync?.baseline;
  if (stored && Object.prototype.hasOwnProperty.call(stored, path)) return stored[path];
  return item.system?.[path];
}

/** Значение поля на предмете актёра или в документе пака. */
function valueAt(doc, path) {
  if (path === MECH_PATH)    return mechanicsOf(doc);
  if (path === EFFECTS_PATH) return effectsOf(doc);
  return doc?.system?.[path];
}

/**
 * Различия одного предмета актёра относительно найденного документа пака,
 * по верхнеуровневым ключам system. Только поля, где пак реально разошёлся
 * с опорой — остальные не интересны, даже если актёр их правил сам.
 */
export function diffItemAgainstPack(item, packDoc) {
  if (!packDoc) return [];
  const out = [];
  // Механика и эффекты идут последними и на равных правах с полями system
  // (wdbc-lddr, wdbc-9aj9).
  for (const path of [...Object.keys(packDoc.system || {}), MECH_PATH, EFFECTS_PATH]) {
    const packVal = valueAt(packDoc, path);
    const baseVal = baselineFor(item, path);
    if (sameValue(packVal, baseVal)) continue;
    const actorVal = valueAt(item, path);
    let status = sameValue(actorVal, baseVal) ? "clean" : "conflict";

    // Эффекты БЕЗ сохранённой опоры — всегда «решает ГМ», даже когда по
    // формуле выходит «чисто» (wdbc-9aj9, найдено живой проверкой).
    //
    // Опора у поля без своего снимка берётся равной текущему значению, и тогда
    // любое расхождение с паком автоматически считается «чистым» — то есть
    // «актёр не правил». Для полей system это приемлемо: их правит ГМ через
    // лист, и снимок опоры у старых предметов уже проставлен миграцией. Для
    // эффектов снимка нет ни у одного предмета в мире, а правка руками —
    // штатный способ работы с шаблонными Чертами вида «Сверхъестественная
    // Сила (X)»: в паке лежит дефолтный +1, а ГМ вписывает степень конкретного
    // персонажа. Замер на живом мире: у двух персонажей стояло верное +2, и
    // строка предлагала «безопасно» откатить его на паковый +1.
    //
    // Утверждать «актёр не правил», когда сравнивать не с чем, значит врать.
    // Один прогон с применением проставит опору, и дальше поле заработает как
    // все остальные.
    if (path === EFFECTS_PATH && !Array.isArray(item.flags?.[FLAG]?.contentSync?.effectsBaseline))
      status = "conflict";

    out.push({ path, baseVal, actorVal, packVal, status });
  }
  return out;
}

/**
 * Отчёт по набору {id,name,items[]} (актёры или их упрощённые слепки — чистая
 * функция, без обращения к game.*). Строки группируются по (packDoc.uuid,
 * поле) для читаемого превью; реальная единица применения — запись
 * entries[] (один предмет одного актёра), не вся группа.
 */
export function buildSyncReport(actors, index) {
  const rows = new Map();
  const unmatched = [];
  for (const actor of actors) {
    for (const item of actor.items || []) {
      const packDoc = matchPackSource(item, index);
      if (!packDoc) {
        unmatched.push({
          actorId: actor.id, actorName: actor.name,
          itemId: item.id, itemName: item.name, itemType: item.type,
          itemTypeLabel: ITEM_TYPES[item.type] || item.type
        });
        continue;
      }
      for (const d of diffItemAgainstPack(item, packDoc)) {
        const key = `${packDoc.uuid}::${d.path}`;
        if (!rows.has(key)) {
          rows.set(key, {
            key, packUuid: packDoc.uuid, packName: packDoc.name,
            itemType: packDoc.type, itemTypeLabel: ITEM_TYPES[packDoc.type] || packDoc.type,
            path: d.path, packVal: d.packVal, entries: []
          });
        }
        rows.get(key).entries.push({
          entryKey: `${item.id}::${d.path}`,
          actorId: actor.id, actorName: actor.name, itemId: item.id,
          actorVal: d.actorVal, baseVal: d.baseVal, status: d.status
        });
      }
    }
  }
  return { rows: [...rows.values()], unmatched };
}

/** Полные документы всех паков-библиотек предметов системы (Document Item). */
export async function allItemPackDocs() {
  const packs = game.packs.filter(p => p.documentName === "Item" && p.metadata.packageName === "warhammer-dbc");
  const lists = await Promise.all(packs.map(p => p.getDocuments()));
  return lists.flat();
}

/** Живой отчёт по всем актёрам мира. */
export async function buildLiveSyncReport() {
  const index = buildPackIndex(await allItemPackDocs());
  return buildSyncReport(game.actors.contents, index);
}

/**
 * Применяет отмеченные записи (Set entryKey = "<itemId>::<path>"): пишет
 * новое значение поля и одновременно продвигает опору этого поля на то же
 * значение пака — снятая галочка ничего не трогает и не запоминает отказ,
 * та же строка просто предложится снова при следующем прогоне.
 */
export async function applySyncReport(report, selectedKeys) {
  const byActor = new Map();   // actorId -> Map(itemId -> updateObj)
  const effectJobs = [];       // {actorId, itemId, packUuid} — своя механика применения
  for (const row of report.rows) {
    for (const entry of row.entries) {
      if (!selectedKeys.has(entry.entryKey)) continue;
      // Эффекты — встроенная коллекция, а не поле: их не «записать» вместе с
      // system одним updateEmbeddedDocuments. Собираем отдельным списком и
      // применяем ниже пересозданием, тем же приёмом, что миграция эффектов.
      if (row.path === EFFECTS_PATH) {
        effectJobs.push({ actorId: entry.actorId, itemId: entry.itemId, packUuid: row.packUuid });
        continue;
      }
      const actorUpdates = byActor.get(entry.actorId) || new Map();
      byActor.set(entry.actorId, actorUpdates);
      const upd = actorUpdates.get(entry.itemId) || { _id: entry.itemId };
      if (row.path === MECH_PATH) {
        upd[`flags.${FLAG}.mechanics`] = row.packVal;
        upd[`flags.${FLAG}.${MECH_BASELINE_PATH}`] = row.packVal;
      } else {
        upd[`system.${row.path}`] = row.packVal;
        upd[`flags.${FLAG}.${BASELINE_PATH}.${row.path}`] = row.packVal;
      }
      actorUpdates.set(entry.itemId, upd);
    }
  }

  let applied = 0;
  for (const [actorId, updates] of byActor) {
    const actor = game.actors.get(actorId);
    if (!actor) continue;
    const list = [...updates.values()];
    await actor.updateEmbeddedDocuments("Item", list);
    applied += list.length;
  }

  const touched = new Set(byActor.keys());
  for (const job of effectJobs) {
    const actor = game.actors.get(job.actorId);
    const item  = actor?.items?.get(job.itemId);
    const packDoc = item ? await fromUuid(job.packUuid) : null;
    if (!item || !packDoc) continue;
    await replaceItemEffects(item, packDoc);
    touched.add(job.actorId);
    applied += 1;
  }
  return { actors: touched.size, items: applied };
}

/**
 * Заменяет содержательные эффекты предмета на эффекты документа пака.
 *
 * Эффекты Конструктора (флаг `mechEntry`) не трогаются вовсе: их ведёт
 * syncMechanicsEffects, и удалять их отсюда значило бы драться с ним за одну
 * коллекцию. Всё остальное — включая перенесённые старой миграцией эффекты,
 * ради которых сверка и научилась их видеть, — сносится и создаётся заново по
 * паку: точечно править ActiveEffect нечем, у эффекта нет «поля», это документ.
 */
export async function replaceItemEffects(item, packDoc) {
  const stale = effectDocs(item).filter(fx => !effectFlag(fx, "mechEntry")).map(fx => fx.id);
  if (stale.length) await item.deleteEmbeddedDocuments("ActiveEffect", stale);

  const fresh = effectDocs(packDoc)
    .filter(fx => !effectFlag(fx, "mechEntry"))
    .map(fx => {
      const data = fx.toObject ? fx.toObject() : foundry.utils.deepClone(fx);
      // Свой _id копии: id документа пака в другой коллекции ничего не значит и
      // может столкнуться с уже существующим.
      delete data._id;
      delete data._key;
      return data;
    });
  if (fresh.length) await item.createEmbeddedDocuments("ActiveEffect", fresh);

  // Опора двигается на новое значение — как у любого другого поля. Плоский
  // путь с точками, а не setFlag: setFlag кладёт ключ в объект как есть
  // (`{flags:{scope:{"contentSync.effectsBaseline":…}}}`), и вложенность из
  // точки в нём не разворачивается.
  await item.update({ [`flags.${FLAG}.${EFFECTS_BASELINE_PATH}`]: effectsOf(packDoc) });
  return { removed: stale.length, added: fresh.length };
}

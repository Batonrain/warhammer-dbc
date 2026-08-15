// module/apps/faction-cache.mjs
//
// Сторона Foundry для дерева фракций: читает каталог из компендиума и кладёт
// его в реестр (module/rules/factions.mjs), откуда его берут предикаты.
//
// Разделение намеренное. Разбор дерева обязан быть чистыми функциями, иначе
// правила не проверить тестом без запуска игры; а каталог лежит в компендиуме
// и читается асинхронно. Здесь — только чтение и наполнение, ни одной строчки
// самой логики.
//
// Тот же приём, что у кэшей Происхождений и Предсказаний (apps/origin-shared.mjs,
// initPackCaches): собрать после готовности мира и пересобрать, когда фракции
// правят.

import { setFactionIndex, factionKey, factionKeyFromName, getFactionIndex } from "../rules/factions.mjs";

const PACK_ID = "warhammer-dbc.factions";

/** Поля, без которых узел дерева бесполезен. `parent` — прежнее имя, см. faction.mjs. */
const INDEX_FIELDS = ["system.key", "system.parentKey", "system.alsoIn", "system.parent"];

/**
 * Фракции одного компендиума. Берётся ИНДЕКС, а не документы: дереву нужны
 * только ключ и родитель, и грузить ради них сотни предметов незачем.
 *
 * Упавший пак не роняет каталог: сообщаем и идём дальше — потерять одну ветку
 * дерева лучше, чем остаться совсем без него.
 */
async function packFactions(pack) {
  try {
    const index = await pack.getIndex({ fields: INDEX_FIELDS });
    return [...index].filter(e => e.type === "faction");
  } catch (e) {
    console.warn(`Warhammer DBC | не прочитан каталог фракций «${pack.collection}»:`, e);
    return [];
  }
}

/**
 * Перечитывает каталог фракций.
 *
 * Смотрим ВСЕ компендиумы предметов, а не только системный: Мастер заводит
 * свои фракции в собственном паке мира, и без этого обхода они выпадали из
 * дерева целиком — «Входит в состав» показывало сырой ключ вместо подписи,
 * схема происхождения оставалась пустой, а правила по принадлежности на них
 * не срабатывали вовсе.
 *
 * Порядок важен: системный пак идёт первым и при совпадении ключей побеждает
 * как общий справочник; о самом совпадении indexFactions сообщит в консоль.
 * Фракции, заведённые прямо в мире (не в компендиуме), идут последними.
 */
export async function refreshFactionIndex() {
  const worldFactions = game.items.filter(i => i.type === "faction");
  try {
    const own = game.packs.get(PACK_ID);
    const others = game.packs.filter(p =>
      p.documentName === "Item" && p.collection !== PACK_ID);
    const lists = await Promise.all([
      own ? packFactions(own) : [],
      ...others.map(packFactions)
    ]);
    setFactionIndex([...lists.flat(), ...worldFactions]);
  } catch (e) {
    // Пустое дерево — это «правила про фракции не сработают», а не поломка
    // мира: лист персонажа и бой продолжают работать без них.
    console.error("Warhammer DBC | не удалось прочитать каталог фракций:", e);
    setFactionIndex(worldFactions);
  }
}

/**
 * Выдать ключ фракциям, у которых его нет.
 *
 * Ключ выдаётся при создании (module/documents/item.mjs), но записи, заведённые
 * до появления этого правила, остались немыми: на них нельзя сослаться ни
 * ключом-родителем, ни целью Таланта. Руками это чинить незачем — правится один раз
 * при готовности мира, Мастером и молча.
 *
 * Компендиум правим только разблокированный: запись в закрытый пак Foundry
 * всё равно не даст, а ошибка в консоли при каждом запуске бесполезна.
 */
export async function ensureFactionKeys() {
  if (!game.user.isGM) return;
  const taken = new Set([...getFactionIndex().keys()]);
  const fill = async docs => {
    for (const doc of docs) {
      if (doc.type !== "faction" || factionKey(doc)) continue;
      const key = factionKeyFromName(doc.name, taken);
      taken.add(key);
      try { await doc.update({ "system.key": key }); }
      catch (e) { console.warn(`Warhammer DBC | не удалось выдать ключ фракции «${doc.name}»:`, e); }
    }
  };

  await fill(game.items.filter(i => i.type === "faction"));

  // Системный пак и паки самого мира: чужие модули не трогаем — их данные не
  // наши, и правка ключа сломала бы ссылки внутри чужого пакета.
  const packs = game.packs.filter(p =>
    p.documentName === "Item" && !p.locked
    && (p.collection === PACK_ID || p.metadata.packageType === "world"));
  for (const pack of packs) {
    try { await fill(await pack.getDocuments()); }
    catch (e) { console.warn(`Warhammer DBC | ключи фракций в «${pack.collection}»:`, e); }
  }
}

// ── Акторы компендиумов ─────────────────────────────────────────────────────
//
// Вкладке «Состав» нужны не только акторы мира, но и лежащие в компендиумах.
// Индексом тут не обойтись: принадлежность лежит ПРЕДМЕТОМ на акторе, а
// предметы в индекс пака не попадают — приходится грузить документы. Поэтому
// результат кэшируется и пересобирается только тогда, когда акторы правят.

let _packActors = null;

/** Акторы всех компендиумов-акторов: загружаются один раз и кэшируются. */
export async function packActors() {
  if (_packActors) return _packActors;
  const out = [];
  for (const pack of game.packs) {
    if (pack.documentName !== "Actor") continue;
    try { out.push(...await pack.getDocuments()); }
    catch (e) { console.warn(`Warhammer DBC | не прочитан компендиум «${pack.collection}»:`, e); }
  }
  _packActors = out;
  return out;
}

/** Сбросить кэш акторов компендиумов — при любой их правке. */
export function clearPackActorCache() {
  _packActors = null;
}

/**
 * Каталог собирается после готовности мира и пересобирается при правке
 * фракций. Правят их редко (это справочник), поэтому полная пересборка на
 * каждое изменение дешевле, чем точечное обновление с риском разойтись.
 */
export function initFactionIndex() {
  Hooks.once("ready", async () => {
    await refreshFactionIndex();
    await ensureFactionKeys();
    // Ключи могли появиться — каталог перечитываем, иначе дерево останется
    // без только что заведённых записей до перезапуска.
    await refreshFactionIndex();
  });
  const touched = doc => doc?.type === "faction";
  for (const hook of ["createItem", "deleteItem", "updateItem"])
    Hooks.on(hook, doc => { if (touched(doc)) refreshFactionIndex(); });
  // Состав читает акторов компендиумов, и правка любого из них делает кэш
  // неверным. Хук ловит и мировых акторов — сбросить лишний раз дешевле, чем
  // показать устаревший состав.
  for (const hook of ["createActor", "deleteActor", "updateActor", "createItem", "deleteItem"])
    Hooks.on(hook, () => clearPackActorCache());
}

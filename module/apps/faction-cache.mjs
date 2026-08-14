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

import { setFactionIndex } from "../rules/factions.mjs";

const PACK_ID = "warhammer-dbc.factions";

/**
 * Перечитывает каталог фракций.
 *
 * Берётся ИНДЕКС компендиума, а не сами документы: дереву нужны только ключ и
 * родитель, и грузить ради них сотни предметов незачем.
 */
export async function refreshFactionIndex() {
  try {
    const pack = game.packs.get(PACK_ID);
    if (!pack) return setFactionIndex([]);
    const index = await pack.getIndex({ fields: ["system.key", "system.parent"] });
    setFactionIndex([...index]);
  } catch (e) {
    // Пустое дерево — это «правила про фракции не сработают», а не поломка
    // мира: лист персонажа и бой продолжают работать без них.
    console.error("Warhammer DBC | не удалось прочитать каталог фракций:", e);
    setFactionIndex([]);
  }
}

/**
 * Каталог собирается после готовности мира и пересобирается при правке
 * фракций. Правят их редко (это справочник), поэтому полная пересборка на
 * каждое изменение дешевле, чем точечное обновление с риском разойтись.
 */
export function initFactionIndex() {
  Hooks.once("ready", () => refreshFactionIndex());
  const touched = doc => doc?.type === "faction";
  for (const hook of ["createItem", "deleteItem", "updateItem"])
    Hooks.on(hook, doc => { if (touched(doc)) refreshFactionIndex(); });
}

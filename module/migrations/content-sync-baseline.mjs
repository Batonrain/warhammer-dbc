// module/migrations/content-sync-baseline.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Бутстрап опоры для «Обновить мир» (module/apps/content-sync.mjs).
//
//  Диффинг там трёхсторонний: опора/актёр/пак, поле-в-поле, хранится во
//  flags.warhammer-dbc.contentSync.baseline.<path> на самом предмете. У
//  предметов, заведённых ДО появления этой функции, опоры ещё нет — движок
//  content-sync.mjs сам подставляет вместо неё текущее значение поля (первое
//  расхождение с паком будет безопасно "чистым"), но явный снимок надёжнее
//  подразумеваемого: эта миграция один раз проставляет его для всех уже
//  существующих предметов, у которых нашлось соответствие в паке.
//
//  Предметы, созданные ПОСЛЕ этого прогона, опору так и не получат явно — и
//  это ожидаемо: движок обслуживает их тем же неявным правилом «нет опоры —
//  считаем текущее актуальным», отдельного createItem-хука заводить незачем.
// ════════════════════════════════════════════════════════════════════════════

import { buildPackIndex, matchPackSource, allItemPackDocs } from "../apps/content-sync.mjs";

/** Предметы без сохранённой опоры, у которых нашлось соответствие в паке. */
export function itemsNeedingBaseline(items = [], index) {
  return [...items]
    .filter(i => !i.flags?.["warhammer-dbc"]?.contentSync?.baseline)
    .map(item => ({ item, packDoc: matchPackSource(item, index) }))
    .filter(x => x.packDoc);
}

/** Проставляет опору всем предметам актёров мира, у которых её ещё нет. */
export async function stampContentSyncBaseline() {
  if (!game.user?.isGM) { ui.notifications?.warn("Опора синхронизации контента: только для ГМа."); return; }

  const index = buildPackIndex(await allItemPackDocs());
  let stamped = 0;

  try {
    for (const actor of game.actors) {
      const updates = itemsNeedingBaseline(actor.items, index).map(({ item }) => ({
        _id: item.id,
        "flags.warhammer-dbc.contentSync.baseline": foundry.utils.deepClone(item.system)
      }));
      if (updates.length) { await actor.updateEmbeddedDocuments("Item", updates); stamped += updates.length; }
    }
  } catch (e) { console.error("Warhammer DBC | Опора синхронизации контента:", e); }

  const msg = `Опора синхронизации контента проставлена: ${stamped} предметов.`;
  console.log("Warhammer DBC |", msg);
  return { stamped };
}

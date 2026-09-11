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

/**
 * Простановка опоры предметам ОДНОГО актора. Бросает исключение наружу —
 * решение, что делать со сбоем (пропустить и продолжить остальных), принимает
 * вызывающий код в stampContentSyncBaseline (тот же приём, что и в
 * module/migrations/gear-equipped.mjs).
 */
async function stampOneActorContentSyncBaseline(actor, index) {
  const updates = itemsNeedingBaseline(actor.items, index).map(({ item }) => ({
    _id: item.id,
    "flags.warhammer-dbc.contentSync.baseline": foundry.utils.deepClone(item.system)
  }));
  if (updates.length) await actor.updateEmbeddedDocuments("Item", updates);
  return updates.length;
}

/**
 * Проставляет опору всем предметам актёров мира, у которых её ещё нет, а
 * также предметам несвязанных токенов сцен (wdbc-059h, по образцу gear-
 * equipped/wdbc-dyi): у токена с actorLink:false предметы лежат в его
 * собственной ActorDelta, а не в мировом Actor — такой токен не входит в
 * game.actors и без отдельного прохода остался бы не замечен.
 *
 * Ошибка на одном акторе/токене логируется и пропускается, не прерывая
 * обработку следующих: опоры разных персонажей друг от друга не зависят.
 */
export async function stampContentSyncBaseline() {
  if (!game.user?.isGM) { ui.notifications?.warn("Опора синхронизации контента: только для ГМа."); return; }

  const index = buildPackIndex(await allItemPackDocs());
  let stamped = 0;
  let failed = 0;

  // Мировые акторы. Связанные токены (actorLink:true) используют тот же
  // документ Actor — им отдельный проход не нужен.
  for (const actor of game.actors) {
    try {
      stamped += await stampOneActorContentSyncBaseline(actor, index);
    } catch (e) {
      failed++;
      console.error(`Warhammer DBC | Опора синхронизации контента: сбой на акторе «${actor.name}» (${actor.id}), пропущен:`, e);
    }
  }

  // Несвязанные токены сцен: их синтетический актор (tokenDoc.actor) пишет
  // прямо в ActorDelta токена.
  for (const scene of game.scenes ?? []) {
    for (const tokenDoc of scene.tokens?.contents ?? []) {
      if (tokenDoc.actorLink) continue;
      const actor = tokenDoc.actor;
      if (!actor) continue;
      try {
        stamped += await stampOneActorContentSyncBaseline(actor, index);
      } catch (e) {
        failed++;
        console.error(`Warhammer DBC | Опора синхронизации контента: сбой на токене «${tokenDoc.name}» сцены «${scene.name}» (${tokenDoc.id}), пропущен:`, e);
      }
    }
  }

  const msg = failed
    ? `Опора синхронизации контента проставлена: ${stamped} предметов; ${failed} акторов/токенов пропущено из-за ошибок — миграция повторится при следующей загрузке мира.`
    : `Опора синхронизации контента проставлена: ${stamped} предметов.`;
  console[failed ? "warn" : "log"]("Warhammer DBC |", msg);
  return { stamped, failed };
}

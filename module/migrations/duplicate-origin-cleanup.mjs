// module/migrations/duplicate-origin-cleanup.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Разовая чистка: «осиротевшие» вторые носители Родного мира/Предсказания
//  (wdbc-gbpe).
//
//  Причина дубликатов — гонка в apps/homeworlds.mjs::applyHomeworld(Picks) /
//  apps/divinations.mjs::applyDivination(Picks): «снять прежний носитель,
//  потом выдать новый» без замка от повторного/параллельного вызова
//  (конкретный подтверждённый пример — module/apps/character-wizard.mjs звал
//  applyHomeworldPicks(...).then(...) БЕЗ await). Фикс (module/apps/
//  origin-shared.mjs::withOriginLock) закрывает саму гонку на будущее, эта
//  миграция подчищает то, что уже успело задвоиться на существующих листах.
//
//  Homeworld/divination — ЕДИНСТВЕННЫЕ два вида носителя в проекте, которые
//  сами себя НЕ самотегируют originGrant (см. clearGrantedBy — race/subrace/
//  archetype тегируют сами себя и потому уже самовосстанавливаются на
//  следующий clear без отдельной миграции). Оба архитектурно «не больше
//  одного на актора» — значит «> 1 предмета этого типа» само по себе уже
//  ошибка, без нужды сверяться с книжным содержимым, чтобы решить, что лишнее.
//
//  Держит ПЕРВЫЙ носитель (тот же порядок, что actorHomeworldItem/
//  actorDivinationItem — `.find()`, лист/дропдаун его и показывают), убирает
//  остальные и ТОЛЬКО то, что каждый из них лично выдал (по flags.
//  grantedByItem === id лишнего носителя, homeworlds.mjs/divinations.mjs
//  пишут его на каждую выдачу) — НЕ через clearGrantedBy(actor, tag, extra):
//  та по конструкции сметает ВСЕ untagged носители этого типа разом (нужно
//  для apply*, где старое зачищается перед новой выдачей целиком), здесь же
//  нужно снять только ЛИШНИЕ носители, не трогая тот, что остаётся.
// ════════════════════════════════════════════════════════════════════════════

const FLAG = "warhammer-dbc";
const GRANT = "originGrant";

const CARRIER_TYPES = [
  { type: "homeworld",   tag: "homeworld" },
  { type: "divination",  tag: "divination" }
];

/** id-ы предметов-носителей сверх первого, У ОДНОГО актора, по одному виду носителя. */
function extraCarrierIds(actor, type) {
  const carriers = actor.items.filter(i => i.type === type);
  return carriers.slice(1).map(i => i.id);
}

/**
 * Чистка ОДНОГО актора: для каждого лишнего носителя — сам носитель плюс
 * то, что ИМЕННО ОН выдал (grantedByItem указывает на конкретного носителя,
 * не просто на тег — двух homeworld-носителей отличить друг от друга можно
 * только так). Возвращает число снятых носителей (не считая их выдачи).
 */
async function migrateOneActorDuplicateOrigins(actor) {
  let removed = 0;
  for (const { type, tag } of CARRIER_TYPES) {
    for (const id of extraCarrierIds(actor, type)) {
      const extra = actor.items.get(id);
      if (!extra) continue; // на всякий случай, если список уже поменялся
      const grantedByThis = actor.items.filter(i =>
        i.getFlag(FLAG, GRANT) === tag && i.getFlag(FLAG, "grantedByItem") === id);
      const ids = [id, ...grantedByThis.map(i => i.id)];
      await actor.deleteEmbeddedDocuments("Item", ids);
      removed++;
    }
  }
  return removed;
}

/**
 * Сносит лишние носители у акторов мира и у несвязанных токенов сцен (тот же
 * охват, что module/migrations/gene-seed-cleanup.mjs — см. её шапку). Ошибка
 * на одном акторе/токене логируется и пропускается, не прерывая остальных.
 */
export async function migrateDuplicateOrigins() {
  if (!game.user?.isGM) { ui.notifications?.warn("Чистка дублей Происхождения: только для ГМа."); return; }
  let actorCount = 0, failed = 0;

  for (const actor of game.actors) {
    try {
      actorCount += await migrateOneActorDuplicateOrigins(actor);
    } catch (e) {
      failed++;
      console.error(`Warhammer DBC | Чистка дублей Происхождения: сбой на акторе «${actor.name}» (${actor.id}), пропущен:`, e);
    }
  }

  for (const scene of game.scenes ?? []) {
    for (const tokenDoc of scene.tokens?.contents ?? []) {
      if (tokenDoc.actorLink) continue;
      const actor = tokenDoc.actor;
      if (!actor) continue;
      try {
        actorCount += await migrateOneActorDuplicateOrigins(actor);
      } catch (e) {
        failed++;
        console.error(`Warhammer DBC | Чистка дублей Происхождения: сбой на токене «${tokenDoc.name}» сцены «${scene.name}» (${tokenDoc.id}), пропущен:`, e);
      }
    }
  }

  const msg = failed
    ? `Лишние носители Родного мира/Предсказания сняты: ${actorCount}; ${failed} акторов/токенов пропущено из-за ошибок — миграция повторится при следующей загрузке мира.`
    : `Лишние носители Родного мира/Предсказания сняты: ${actorCount}.`;
  console[failed ? "warn" : "log"]("Warhammer DBC |", msg);
  if (actorCount || failed) ui.notifications?.[failed ? "warn" : "info"]("Warhammer DBC: " + msg);
  return { actorCount, failed };
}

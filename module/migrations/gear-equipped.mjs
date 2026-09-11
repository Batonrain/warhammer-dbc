// module/migrations/gear-equipped.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Одноразовая простановка «надето» носимому снаряжению существующих акторов
//  (wdbc-9h7g).
//
//  До появления system.equipped у снаряжения (module/data/item/gear.mjs) любой
//  предмет с Механикой действовал фактом владения: противогаз защищал от газа,
//  лёжа в рюкзаке. Теперь носимое снаряжение (у которого заполнено «Как
//  носится» — см. gearRequiresWearing в module/apps/effects.mjs) работает
//  только надетым.
//
//  ПОЧЕМУ true, А НЕ false. Новое поле приходит со значением «не надето», и
//  без миграции у всех уже собранных персонажей разом погасли бы работающие
//  бонусы — молча, без единой строчки в чате: игрок обнаружил бы пропажу +30 T
//  от противогаза посреди боя и не понял, почему. Поэтому вещь, которая
//  работала вчера, считается надетой и сегодня, а дальше её можно снять
//  галочкой на вкладке СНАРЯЖЕНИЕ. Тот же принцип, что у запрета носить два
//  жёстких элемента брони (wdbc-8b5): новое правило действует на новые
//  действия, старые листы не ломает.
//
//  Отсюда же и граница: миграция трогает только предметы АКТОРОВ и только те,
//  где поле ещё не проставлено. Компендиум не трогается вовсе — там лежат
//  образцы, а не носимые вещи: купленное после обновления снаряжение приходит
//  ненадетым, и это правильно.
// ════════════════════════════════════════════════════════════════════════════

import { gearRequiresWearing } from "../apps/effects.mjs";

/**
 * Носимое снаряжение актора, которое ещё не отмечено надетым.
 *
 * Отличить «поле новое, его никто не трогал» от «игрок сам снял вещь» здесь
 * нечем: схема подставляет false обоим (module/data/item/gear.mjs). Поэтому
 * защита — не в фильтре, а в одноразовости: миграция идёт ровно один раз, в
 * первый запуск мира после обновления, когда тумблера ещё не существовало и
 * снять вещь было физически негде. Ручной перезапуск
 * (game.warhammerDBC.migrateGearEquipped()) читается как «надеть всё носимое
 * заново» — это осознанная команда ГМа, а не случайность.
 */
export function gearNeedingEquipped(items = []) {
  return [...items].filter(i => i.type === "gear"
    && gearRequiresWearing(i.system)
    && !i.system?.equipped);
}

/**
 * Простановка «надето» снаряжению ОДНОГО актора. Бросает исключение наружу —
 * решение о том, что делать со сбоем на одном акторе (пропустить и продолжить
 * остальных), принимает вызывающий код в migrateGearEquipped, а не эта
 * функция: у неё нет доступа к «сколько акторов ещё впереди».
 */
async function migrateOneActorGear(actor) {
  const updates = gearNeedingEquipped(actor.items)
    .map(item => ({ _id: item.id, "system.equipped": true }));
  if (updates.length) await actor.updateEmbeddedDocuments("Item", updates);
  return updates.length;
}

/**
 * Проставляет «надето» носимому снаряжению всех акторов мира, а также
 * несвязанных токенов на сценах (wdbc-dyi): у токена с actorLink:false
 * предметы лежат в его собственной ActorDelta, а не в мировом Actor — такой
 * токен не входит в game.actors и без отдельного прохода остался бы вовсе не
 * замечен, независимо от прочих сбоев.
 *
 * Ошибка на одном акторе/токене (wdbc-dyi: было — try на весь цикл сразу,
 * сбой глушил миграцию остальных акторов молча) логируется и пропускается,
 * не прерывая обработку следующих: gear-equipped идёт по вещам разных
 * персонажей, и они друг от друга не зависят.
 */
export async function migrateGearEquipped() {
  if (!game.user?.isGM) { ui.notifications?.warn("Надетое снаряжение: только для ГМа."); return; }

  let updated = 0;
  let failed = 0;

  // Мировые акторы. Связанные токены (actorLink:true) используют тот же
  // документ Actor — им отдельный проход не нужен.
  for (const actor of game.actors) {
    try {
      updated += await migrateOneActorGear(actor);
    } catch (e) {
      failed++;
      console.error(`Warhammer DBC | Надетое снаряжение: сбой на акторе «${actor.name}» (${actor.id}), пропущен:`, e);
    }
  }

  // Несвязанные токены сцен: их синтетический актор (tokenDoc.actor) пишет
  // прямо в ActorDelta токена — тот же приём, что и везде в проекте
  // (module/combat/*.mjs, module/regions/*.mjs — tokenDoc.actor).
  for (const scene of game.scenes ?? []) {
    for (const tokenDoc of scene.tokens?.contents ?? []) {
      if (tokenDoc.actorLink) continue;
      const actor = tokenDoc.actor;
      if (!actor) continue;
      try {
        updated += await migrateOneActorGear(actor);
      } catch (e) {
        failed++;
        console.error(`Warhammer DBC | Надетое снаряжение: сбой на токене «${tokenDoc.name}» сцены «${scene.name}» (${tokenDoc.id}), пропущен:`, e);
      }
    }
  }

  const msg = failed
    ? `Носимое снаряжение отмечено надетым: ${updated} предметов; ${failed} акторов/токенов пропущено из-за ошибок — миграция повторится при следующей загрузке мира.`
    : `Носимое снаряжение отмечено надетым: ${updated} предметов.`;
  console[failed ? "warn" : "log"]("Warhammer DBC |", msg);
  if (updated || failed) ui.notifications?.[failed ? "warn" : "info"]("Warhammer DBC: " + msg);
  return { updated, failed };
}

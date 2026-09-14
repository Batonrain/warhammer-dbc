// module/migrations/char-damage-sign.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Одноразовая инверсия знака system.charDamage.* у существующих актёров.
//
//  Поле сменило смысл: было «Урон в характеристику» (положительное число,
//  ВЫЧИТАЛОСЬ из Итого, инпут с min="0"), стало знаковым «Мод.» (прибавляется:
//  плюс — бонус, минус — штраф). Сохранённые положительные значения означали
//  штраф — без инверсии персонаж с уроном 10 в Силу получил бы +10 вместо
//  −10, молча, разброс в 20 очков.
//
//  Писателей у поля, кроме инпута листа, нет — миграция ограничивается одним
//  проходом по актёрам мира.
// ════════════════════════════════════════════════════════════════════════════

/** Обновление для одного актора: пары путь→значение с обращённым знаком. */
export function charDamageSignUpdate(system = {}) {
  const upd = {};
  for (const [key, val] of Object.entries(system.charDamage || {})) {
    const n = Number(val) || 0;
    if (n !== 0) upd[`system.charDamage.${key}`] = -n;
  }
  return upd;
}

/**
 * Инверсия знака charDamage ОДНОГО актора. Бросает исключение наружу —
 * решение, что делать со сбоем (пропустить и продолжить остальных), принимает
 * вызывающий код в migrateCharDamageSign (тот же приём, что и в
 * module/migrations/gear-equipped.mjs). Возвращает 1, если актора реально
 * обновили, иначе 0.
 */
async function migrateOneActorCharDamageSign(actor) {
  const upd = charDamageSignUpdate(actor.system);
  if (!Object.keys(upd).length) return 0;
  await actor.update(upd);
  return 1;
}

/**
 * Инвертирует знак charDamage у всех актёров мира, а также у несвязанных
 * токенов сцен (wdbc-059h, по образцу gear-equipped/wdbc-dyi): у токена с
 * actorLink:false system лежит в его собственной ActorDelta, а не в мировом
 * Actor — такой токен не входит в game.actors и без отдельного прохода
 * остался бы не замечен.
 *
 * Ошибка на одном акторе/токене логируется и пропускается, не прерывая
 * обработку следующих: charDamage разных персонажей друг от друга не зависит.
 */
export async function migrateCharDamageSign() {
  if (!game.user?.isGM) { ui.notifications?.warn("Знак Мод. характеристик: только для ГМа."); return; }
  let actorCount = 0;
  let failed = 0;

  // Мировые акторы. Связанные токены (actorLink:true) используют тот же
  // документ Actor — им отдельный проход не нужен.
  for (const actor of game.actors) {
    try {
      actorCount += await migrateOneActorCharDamageSign(actor);
    } catch (e) {
      failed++;
      console.error(`Warhammer DBC | Знак Мод. характеристик: сбой на акторе «${actor.name}» (${actor.id}), пропущен:`, e);
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
        actorCount += await migrateOneActorCharDamageSign(actor);
      } catch (e) {
        failed++;
        console.error(`Warhammer DBC | Знак Мод. характеристик: сбой на токене «${tokenDoc.name}» сцены «${scene.name}» (${tokenDoc.id}), пропущен:`, e);
      }
    }
  }

  const msg = failed
    ? `Знак Мод. характеристик обращён у ${actorCount} актёров; ${failed} акторов/токенов пропущено из-за ошибок — миграция повторится при следующей загрузке мира.`
    : `Знак Мод. характеристик обращён у ${actorCount} актёров.`;
  console[failed ? "warn" : "log"]("Warhammer DBC |", msg);
  if (actorCount || failed) ui.notifications?.[failed ? "warn" : "info"]("Warhammer DBC: " + msg);
  return { actorCount, failed };
}

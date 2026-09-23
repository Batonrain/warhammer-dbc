// module/migrations/sight-angle.mjs
// ════════════════════════════════════════════════════════════════════════
//  Угол обзора 210° у уже созданных акторов и расставленных токенов
//  (приёмка стопки #482-#504, wdbc-bjy1.6).
//
//  ЧТО СЛУЧИЛОСЬ. Стопка завела хук preCreateActor (combat/facing.mjs::
//  applyDefaultSightAngle): новый актор получает prototypeToken.sight.angle
//  = 210°, если угол не настроен. Хук срабатывает только при СОЗДАНИИ — у
//  всех прежних акторов и их токенов остался Foundry-дефолт 360°, а
//  isOutsideDefenderSight читает 360 как «видит всё». Итог: атака со слепой
//  стороны (и Скрытная Атака на ней) работает по новым персонажам и молча
//  не работает по старым за тем же столом. «Обновить мир» сюда не достаёт —
//  он сверяет только предметы.
//
//  Правило то же, что у хука (isUnsetSightAngle): трогаем пусто/0/360, любой
//  другой угол — чья-то настройка, её не касаемся. Токен на сцене несёт свой
//  sight отдельно от прототипа (и связанный, и несвязанный), поэтому проход
//  по сценам — отдельный, по всем токенам.
// ════════════════════════════════════════════════════════════════════════

import { DEFAULT_SIGHT_ANGLE_DEGREES, isUnsetSightAngle } from "../combat/facing.mjs";

/** Правка прототипа актора или null, если угол уже настроен. */
export function actorSightAngleFix(actor) {
  if (!isUnsetSightAngle(actor?.prototypeToken?.sight?.angle)) return null;
  return { "prototypeToken.sight.angle": DEFAULT_SIGHT_ANGLE_DEGREES };
}

/** Правки токенов одной сцены — пакетом для updateEmbeddedDocuments. */
export function sceneSightAngleFixes(scene) {
  return (scene?.tokens?.contents ?? [])
    .filter(t => isUnsetSightAngle(t?.sight?.angle))
    .map(t => ({ _id: t.id, "sight.angle": DEFAULT_SIGHT_ANGLE_DEGREES }));
}

/**
 * Прогон по миру. Идемпотентно: после правки угол 210 и второй прогон
 * ничего не находит. Сбой на акторе/сцене логируется и пропускается; версию
 * вызывающий код штампует только при failed === 0.
 */
export async function migrateSightAngle() {
  if (!game.user?.isGM) {
    ui.notifications?.warn("Угол обзора 210°: только для ГМа.");
    return;
  }
  let actors = 0;
  let tokens = 0;
  let failed = 0;

  for (const actor of game.actors) {
    const patch = actorSightAngleFix(actor);
    if (!patch) continue;
    try { await actor.update(patch); actors++; }
    catch (e) {
      failed++;
      console.error(`Warhammer DBC | Угол обзора: сбой на акторе «${actor.name}» (${actor.id}), пропущен:`, e);
    }
  }

  for (const scene of game.scenes ?? []) {
    const updates = sceneSightAngleFixes(scene);
    if (!updates.length) continue;
    try { await scene.updateEmbeddedDocuments("Token", updates, { animate: false }); tokens += updates.length; }
    catch (e) {
      failed++;
      console.error(`Warhammer DBC | Угол обзора: сбой на сцене «${scene.name}» (${scene.id}), пропущена:`, e);
    }
  }

  const msg = failed
    ? `Угол обзора 210°: акторов — ${actors}, токенов — ${tokens}; ${failed} акторов/сцен пропущено из-за ошибок — миграция повторится при следующей загрузке мира.`
    : `Угол обзора 210°: акторов — ${actors}, токенов — ${tokens} (атака со слепой стороны теперь работает и по старым персонажам).`;
  console[failed ? "warn" : "log"]("Warhammer DBC |", msg);
  if (actors || tokens || failed) ui.notifications?.[failed ? "warn" : "info"]("Warhammer DBC: " + msg);
  return { actors, tokens, failed };
}

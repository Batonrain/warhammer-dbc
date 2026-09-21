// module/migrations/nimble-rating.mjs
// ════════════════════════════════════════════════════════════════════════
//  Nimble / Проворный — проставление Рейтинга у уже выданных копий Черты
//  (приёмка стопки #482-#504, wdbc-b079).
//
//  ЧТО СЛУЧИЛОСЬ. Правило «Проворный» (rules/library/core.mjs) раньше
//  считало штраф атакующим от Бонуса Ловкости ЦЕЛИ; стопка привела его к
//  книге — штраф равен РЕЙТИНГУ самой Черты (`targetTraitRating`,
//  rules/resolve-test.mjs::traitRatingSum). В записях пака рейтинг заодно
//  проставлен (hasRating:true, rating:10).
//
//  Пак догоняет только НОВЫЕ копии. Предмет на живом акторе — снимок момента
//  выдачи: у всех уже созданных Астартес, Азуриан, Друкхари и Кроорков (а
//  также у существ бестиария, розданных до этой правки) Черта несёт
//  hasRating:false, rating:0. `traitRatingSum` такую Черту в сумму не берёт,
//  и правило продолжает отбираться, но даёт −0 — молча, без единой строки в
//  чек-листе. Ровно тот «тихий +0», от которого предостерегает комментарий
//  в самом правиле.
//
//  Рейтинг берётся из названия Черты, когда книга записала его прямо там
//  («Nimble (10)», «Nimble (20)» — так у существ бестиария), иначе — 10:
//  столько стоит в обеих записях пака traits, к которым отсылают все расы.
//
//  Приём и структура — те же, что в warpforged-plate-fix.mjs: чистая
//  проверка без побочных эффектов (для теста), правка одного предмета,
//  изоляция сбоя по актору и отдельный проход по несвязанным токенам сцен
//  (wdbc-059h).
// ════════════════════════════════════════════════════════════════════════

const NAMES = ["Nimble", "Проворный"];
/** Рейтинг записи пака — им же чинятся копии, в чьём имени числа нет. */
const BOOK_RATING = 10;

/** Это копия Черты «Проворный»? Сравнение по любой половине имени. */
export function isNimbleItem(item) {
  if (!item || item.type !== "trait") return false;
  const full = String(item.name || "");
  return NAMES.some(n => full.includes(n));
}

/** Рейтинг X из названия: «Nimble (20) / Проворный» → 20; нет числа → 0. */
export function ratingFromName(name) {
  return Number(String(name ?? "").match(/\((\d+)\)/)?.[1]) || 0;
}

/**
 * Какой Рейтинг должна нести эта копия. Чтение без побочных эффектов — для
 * миграции и для теста. `null` — трогать не нужно (не та Черта либо Рейтинг
 * уже проставлен: раз галочка стоит, число на предмете главнее книжного).
 */
export function nimbleRatingFix(item) {
  if (!isNimbleItem(item)) return null;
  if (item.system?.hasRating) return null;
  return ratingFromName(item.name) || BOOK_RATING;
}

/**
 * Правит ОДНУ копию. Идемпотентно: после правки hasRating уже стоит, и
 * второй прогон предмет не трогает. Возвращает true, если что-то поправлено.
 */
export async function fixNimbleItem(item) {
  const rating = nimbleRatingFix(item);
  if (rating === null) return false;
  await item.update({ "system.hasRating": true, "system.rating": rating });
  return true;
}

/** Правит ОДНОГО актора (или синтетического актора несвязанного токена). */
async function migrateOneActor(actor) {
  let fixed = 0;
  for (const item of actor.items) {
    if (await fixNimbleItem(item)) fixed++;
  }
  return fixed;
}

/**
 * Правит всех акторов мира и несвязанные токены сцен. Ошибка на одном
 * акторе/токене логируется и пропускается, не прерывая остальных; версия
 * миграции штампуется вызывающим кодом только при полном успехе.
 */
export async function migrateNimbleRating() {
  if (!game.user?.isGM) {
    ui.notifications?.warn("Правка Черты «Проворный»: только для ГМа.");
    return;
  }
  let fixed = 0;
  let failed = 0;

  for (const actor of game.actors) {
    try { fixed += await migrateOneActor(actor); }
    catch (e) {
      failed++;
      console.error(`Warhammer DBC | «Проворный»: сбой на акторе «${actor.name}» (${actor.id}), пропущен:`, e);
    }
  }

  for (const scene of game.scenes ?? []) {
    for (const tokenDoc of scene.tokens?.contents ?? []) {
      if (tokenDoc.actorLink) continue;
      const actor = tokenDoc.actor;
      if (!actor) continue;
      try { fixed += await migrateOneActor(actor); }
      catch (e) {
        failed++;
        console.error(`Warhammer DBC | «Проворный»: сбой на токене «${tokenDoc.name}» сцены «${scene.name}» (${tokenDoc.id}), пропущен:`, e);
      }
    }
  }

  const msg = failed
    ? `«Проворный»: выправлено копий — ${fixed}; ${failed} акторов/токенов пропущено из-за ошибок — миграция повторится при следующей загрузке мира.`
    : `«Проворный»: выправлено копий — ${fixed} (штраф атакующим снова считается от Рейтинга Черты).`;
  console[failed ? "warn" : "log"]("Warhammer DBC |", msg);
  if (fixed || failed) ui.notifications?.[failed ? "warn" : "info"]("Warhammer DBC: " + msg);
  return { fixed, failed };
}

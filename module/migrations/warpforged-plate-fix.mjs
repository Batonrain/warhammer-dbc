// module/migrations/warpforged-plate-fix.mjs
// ════════════════════════════════════════════════════════════════════════
//  Warpforged Plate / Закалённые Варпом Латы — снятие запечённого
//  ActiveEffect у уже выданных копий (приём стопки #478-#481, 14.09.2026).
//
//  ЧТО СЛУЧИЛОСЬ. Черта раньше давала свои 12 AP складываемой надбавкой:
//  `system.effects.armourAll: 12` плюс ActiveEffect с шестью изменениями
//  `system.armorBonus.<локация> add 12`. Стопка перевела её на «броню-
//  замену» — тот же приём, что у Чёрного Панциря: код держит ПОЛ в 12 AP
//  (rules/character.mjs::armorFloorLoc), а из документа пака и надбавка, и
//  эффект убраны.
//
//  Пак догоняет только НОВЫЕ копии. Предмет на живом акторе — снимок момента
//  выдачи, и у него ActiveEffect остался. Легаси-поле `armourAll` при этом
//  безвредно (его глушит гейт `migratedEffect` в rules/character.mjs), а вот
//  эффект по-прежнему попадает в `system.armorBonus`, и итоговая формула
//  (character.mjs) складывает пол с надбавкой:
//      max(0, best(k) + traitArmourAll + traitArmorLoc[k] + fxArmor[k] - ...)
//      было:  0 + 12 = 12   — книжно верно
//      стало: 12 + 12 = 24  — вдвое больше книги, молча
//
//  Поэтому нужен проход по живым мирам: снять у копий именно эти шесть
//  изменений. Пол в коде даст те же 12 AP, что и раньше.
//
//  Приём и структура — те же, что в born-for-war-fix.mjs: чистая проверка
//  без побочных эффектов (для теста), правка одного предмета, изоляция сбоя
//  по актору и отдельный проход по несвязанным токенам сцен (wdbc-059h).
// ════════════════════════════════════════════════════════════════════════

const NAMES = ["Warpforged Plate", "Закалённые Варпом Латы"];
/** Ключи изменений, которые ставила старая версия Черты. */
const ARMOR_BONUS_PREFIX = "system.armorBonus.";

const nameMatches = (item) => {
  const full = String(item?.name || "");
  return NAMES.some(n => full.includes(n));
};

/** Это копия Черты «Закалённые Варпом Латы»? */
export function isWarpforgedPlateItem(item) {
  return !!item && item.type === "trait" && nameMatches(item);
}

/** Изменение из старой версии Черты: +12 AP в локацию. */
function isStaleArmorChange(c) {
  return String(c?.key || "").startsWith(ARMOR_BONUS_PREFIX) && (Number(c?.value) || 0) > 0;
}

/**
 * Несёт ли копия ещё запечённую надбавку брони. Чтение без побочных
 * эффектов — для миграции и для теста.
 */
export function warpforgedPlateHasStaleArmour(item) {
  if (!isWarpforgedPlateItem(item)) return false;
  return (item.effects ?? []).some(fx => (fx.system?.changes ?? []).some(isStaleArmorChange));
}

/**
 * Снимает у ОДНОЙ копии изменения `system.armorBonus.*`. Эффект, в котором
 * кроме них ничего не осталось, удаляется целиком. Идемпотентно: после
 * правки warpforgedPlateHasStaleArmour возвращает false и второй прогон
 * предмет не трогает. Возвращает true, если что-то поправлено.
 */
export async function fixWarpforgedPlateItem(item) {
  if (!warpforgedPlateHasStaleArmour(item)) return false;

  const toDelete = [];
  for (const fx of item.effects ?? []) {
    const changes = fx.system?.changes ?? [];
    const kept = changes.filter(c => !isStaleArmorChange(c));
    if (kept.length === changes.length) continue;
    if (kept.length) await fx.update({ "system.changes": kept });
    else toDelete.push(fx.id);
  }
  if (toDelete.length) await item.deleteEmbeddedDocuments("ActiveEffect", toDelete);
  return true;
}

/** Правит ОДНОГО актора (или синтетического актора несвязанного токена). */
async function migrateOneActor(actor) {
  let fixed = 0;
  for (const item of actor.items) {
    if (await fixWarpforgedPlateItem(item)) fixed++;
  }
  return fixed;
}

/**
 * Правит всех акторов мира и несвязанные токены сцен. Ошибка на одном
 * акторе/токене логируется и пропускается, не прерывая остальных; версия
 * миграции штампуется вызывающим кодом только при полном успехе.
 */
export async function migrateWarpforgedPlate() {
  if (!game.user?.isGM) {
    ui.notifications?.warn("Правка Черты «Закалённые Варпом Латы»: только для ГМа.");
    return;
  }
  let fixed = 0;
  let failed = 0;

  for (const actor of game.actors) {
    try { fixed += await migrateOneActor(actor); }
    catch (e) {
      failed++;
      console.error(`Warhammer DBC | «Закалённые Варпом Латы»: сбой на акторе «${actor.name}» (${actor.id}), пропущен:`, e);
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
        console.error(`Warhammer DBC | «Закалённые Варпом Латы»: сбой на токене «${tokenDoc.name}» сцены «${scene.name}» (${tokenDoc.id}), пропущен:`, e);
      }
    }
  }

  const msg = failed
    ? `«Закалённые Варпом Латы»: выправлено копий — ${fixed}; ${failed} акторов/токенов пропущено из-за ошибок — миграция повторится при следующей загрузке мира.`
    : `«Закалённые Варпом Латы»: выправлено копий — ${fixed} (броня вернулась к книжным 12 AP).`;
  console[failed ? "warn" : "log"]("Warhammer DBC |", msg);
  if (fixed || failed) ui.notifications?.[failed ? "warn" : "info"]("Warhammer DBC: " + msg);
  return { fixed, failed };
}

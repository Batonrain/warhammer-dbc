// module/migrations/born-for-war-fix.mjs
// ════════════════════════════════════════════════════════════════════════
//  wdbc-7ba: Предсказание «Ты рождён для войны» (packs-src/divinations)
//  поменяло механику под книжный текст (dccb2a08, wdbc-07a6):
//    - снята альтернатива «Стойкость +3» — в книге у первой ИЛИ-группы
//      только WS/BS/Ag/S, «Т» там никогда не было (данные пака её добавили
//      по ошибке);
//    - вторая ИЛИ-группа (Int/Fel) была op:"add" (давала +3), стала
//      op:"subtract" — книга: «I или F −3».
//
//  Правка ТОЛЬКО packs-src (компендиум) уже применённых копий не трогает.
//  Выбор в ИЛИ-группе Конструктор отыгрывает ОДИН раз, диалогом, при выдаче
//  предмета (module/apps/mechanics.mjs::applyGroupEntries), и рождённый
//  тогда ActiveEffect дальше не пересобирается НИЧЕМ:
//    - applyItemMechanics (хук updateItem/createItem) — если выбранной была
//      снятая «Т», её id не совпадёт ни с одним из entries.id, что осталась
//      в первой ИЛИ-группе, и applyGroupEntries сочтёт вопрос ещё НЕ
//      заданным — заново спросит диалогом. Для остальных трёх альтернатив и
//      для второй группы (Int/Fel — id записей не менялись, только op)
//      applyGroupEntries увидит применённый id среди текущих entries и молча
//      выйдет, эффект не тронув;
//    - syncMechanicsEffects — ИЛИ-ветвенные записи пропускает нарочно
//      (mechanics.mjs::collectMechEntries: «выбор в ИЛИ делается один раз
//      диалогом при получении»), эффект такой записи не трогает никогда;
//    - «Обновить мир» (module/apps/content-sync.mjs) переписывает только
//      flags.warhammer-dbc.mechanics (список записей Конструктора) — тот же
//      updateItem триггерит ровно applyItemMechanics/syncMechanicsEffects
//      выше, с тем же результатом.
//
//  У акторов, кому Предсказание досталось ДО dccb2a08, эффект так и несёт
//  старые числа: если была выбрана снятая «Т» — лишние +3 к Стойкости;
//  Int/Fel — op:"add" вместо op:"subtract" (в листе бонус вместо штрафа).
//
//  Лечит точечной правкой changes самого ActiveEffect предмета — тем же
//  приёмом, что repairBlackCarapaceStacking/fixGeneSeedEffects (migrations/
//  item-effects.mjs, migrations/legion-geneseed-size-fix.mjs), а не
//  повторным применением Механики: так безопасно гонять массово, без
//  диалогов выбора ИЛИ-группы на каждого затронутого актора.
//
//  Сознательно НЕ трогает flags.warhammer-dbc.mechanics/mechanicsApplied на
//  самом предмете — правка этого флага тем же item.update() заново
//  триггерит хук updateItem → applyItemMechanics и, если игрок когда-то
//  выбрал снятую «Т», переспросила бы ИЛИ-группу диалогом у каждого такого
//  актора при массовом прогоне на ready. Панель «Механика» открытого
//  предмета может по-прежнему визуально показывать снятую альтернативу «Т»
//  в списке (косметика редактора, на применённый бонус не влияет) — это
//  осознанно принятое ограничение, не часть этой правки.
// ════════════════════════════════════════════════════════════════════════

const BORN_FOR_WAR_KEY  = "bornwar";
const BORN_FOR_WAR_NAME = "Ты рождён для войны";

const T_EFFECT_KEY   = "system.characteristics.t.totalFx";
const INT_EFFECT_KEY = "system.characteristics.int.totalFx";
const FEL_EFFECT_KEY = "system.characteristics.fel.totalFx";
// Int/Fel — просто меняют знак (add→subtract), Т — снимается целиком (в
// книге у первой ИЛИ-группы такой альтернативы нет вовсе).
const SIGN_FIX_KEYS = new Set([INT_EFFECT_KEY, FEL_EFFECT_KEY]);

/**
 * Это предмет-Предсказание «Ты рождён для войны»? По `system.key` (стабилен,
 * не зависит от локализации/правки названия) с фолбэком на имя — для копий
 * старше появления поля `key` в схеме (module/data/item/divination.mjs).
 */
export function isBornForWarItem(item) {
  if (!item || item.type !== "divination") return false;
  return item.system?.key === BORN_FOR_WAR_KEY || item.name === BORN_FOR_WAR_NAME;
}

/**
 * Есть ли у предмета хоть один ActiveEffect со старыми числами: снятая
 * альтернатива «Т» (ещё op:"add") или Int/Fel всё ещё op:"add" вместо
 * "subtract"? Чтение без побочных эффектов — для миграции и для теста.
 */
export function bornForWarHasStaleEffects(item) {
  if (!isBornForWarItem(item)) return false;
  for (const effect of item.effects ?? []) {
    for (const c of effect.system?.changes ?? []) {
      if (c?.key === T_EFFECT_KEY && c?.type === "add") return true;
      if (SIGN_FIX_KEYS.has(c?.key) && c?.type === "add") return true;
    }
  }
  return false;
}

/**
 * Правит ActiveEffect'ы ОДНОГО предмета «Ты рождён для войны»:
 *  - снимает запись Т снятой альтернативы целиком (если персонаж когда-то
 *    выбрал именно её — бонуса из этой ИЛИ-группы у него больше нет; ГМ
 *    может вручную предложить игроку выбрать один из WS/BS/Ag/S взамен,
 *    автоматически это не решается — выбор всегда делает игрок);
 *  - у Int/Fel меняет op add→subtract, число не трогает (было +3, книжный
 *    вариант — то же 3, но со знаком минус).
 * Идемпотентно: почищенный предмет второй прогон не находит (bornForWar-
 * HasStaleEffects после правки возвращает false) и не трогает.
 * Возвращает true, если что-то поправлено.
 */
export async function fixBornForWarItem(item) {
  if (!bornForWarHasStaleEffects(item)) return false;

  const toDelete = [];
  for (const effect of item.effects ?? []) {
    const changes = effect.system?.changes ?? [];
    if (!changes.length) continue;

    const kept = [];
    let signFlipped = false;
    for (const c of changes) {
      if (c?.key === T_EFFECT_KEY && c?.type === "add") continue; // снятая альтернатива — исчезает целиком
      if (SIGN_FIX_KEYS.has(c?.key) && c?.type === "add") {
        kept.push({ ...c, type: "subtract" });
        signFlipped = true;
        continue;
      }
      kept.push(c);
    }
    if (kept.length === changes.length && !signFlipped) continue; // этот конкретный эффект не тронут

    if (kept.length) await effect.update({ "system.changes": kept });
    else toDelete.push(effect.id);
  }
  if (toDelete.length) await item.deleteEmbeddedDocuments("ActiveEffect", toDelete);
  return true;
}

/** Правит ОДНОГО актора (или синтетического актора несвязанного токена). */
async function migrateOneActorBornForWar(actor) {
  let fixed = 0;
  for (const item of actor.items) {
    if (await fixBornForWarItem(item)) fixed++;
  }
  return fixed;
}

/**
 * Правит всех акторов мира и несвязанные токены сцен (тот же приём, что
 * migrateLegionGeneSeedSize/gear-equipped, wdbc-059h/wdbc-dyi) — у токена с
 * actorLink:false предметы лежат в его собственной ActorDelta, а не в
 * мировом Actor, и без отдельного прохода остались бы не замечены. Ошибка на
 * одном акторе/токене логируется и пропускается, не прерывая обработку
 * остальных.
 */
export async function migrateBornForWarDivination() {
  if (!game.user?.isGM) {
    ui.notifications?.warn("Правка Предсказания «Ты рождён для войны»: только для ГМа.");
    return;
  }
  let fixed = 0;
  let failed = 0;

  for (const actor of game.actors) {
    try { fixed += await migrateOneActorBornForWar(actor); }
    catch (e) {
      failed++;
      console.error(`Warhammer DBC | «Ты рождён для войны»: сбой на акторе «${actor.name}» (${actor.id}), пропущен:`, e);
    }
  }

  for (const scene of game.scenes ?? []) {
    for (const tokenDoc of scene.tokens?.contents ?? []) {
      if (tokenDoc.actorLink) continue;
      const actor = tokenDoc.actor;
      if (!actor) continue;
      try { fixed += await migrateOneActorBornForWar(actor); }
      catch (e) {
        failed++;
        console.error(`Warhammer DBC | «Ты рождён для войны»: сбой на токене «${tokenDoc.name}» сцены «${scene.name}» (${tokenDoc.id}), пропущен:`, e);
      }
    }
  }

  const msg = failed
    ? `«Ты рождён для войны»: выправлено предметов — ${fixed}; ${failed} акторов/токенов пропущено из-за ошибок — миграция повторится при следующей загрузке мира.`
    : `«Ты рождён для войны»: выправлено предметов — ${fixed}.`;
  console[failed ? "warn" : "log"]("Warhammer DBC |", msg);
  if (fixed || failed) ui.notifications?.[failed ? "warn" : "info"]("Warhammer DBC: " + msg);
  return { fixed, failed };
}

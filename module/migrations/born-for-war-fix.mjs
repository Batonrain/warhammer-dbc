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
//    - applyItemMechanics (хук updateItem/createItem) — НЕ переспросит сам:
//      предмет на акторе несёт свой снимок механики, где запись «Т» ещё
//      лежит, и её id — в mechanicsApplied (wdbc-o28t; прежняя надежда
//      «сочтёт вопрос незаданным» была неверной). Переспрашивает второй
//      проход внизу файла — кнопкой ГМа. Для остальных трёх альтернатив и
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

import { esc } from "../helpers/utils.mjs";

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

// ── Второй проход: переспросить выбравших снятую «Т» (wdbc-o28t) ─────────────
//
// Первый проход снимает эффект «+3 Стойкости», но переспросить выбор сам по
// себе не может: предмет на акторе несёт СВОЙ снимок механики, где запись «Т»
// всё ещё лежит, и её id — в mechanicsApplied. applyGroupEntries видит это и
// молча выходит (шапка файла ошибалась, надеясь на обратное). Итог — персонаж
// теряет +3 без единого сообщения.
//
// Переспрашивать массово на загрузке мира нельзя: диалоги выбора всплыли бы у
// ГМа за каждого игрока разом. Поэтому миграция только НАЗЫВАЕТ таких
// персонажей и присылает ГМу карточку с кнопкой «Выбрать замену» у каждого;
// кнопка применяет bornForWarRepickPatch одним item.update, и штатный хук
// updateItem → applyItemMechanics задаёт вопрос диалогом (WS/BS/Ag/S).

const FLAG = "warhammer-dbc";

/** id записи «Т» первой ИЛИ-группы, если она ВЫБРАНА (лежит в mechanicsApplied), иначе null. */
export function bornForWarStaleTChoice(item) {
  if (!isBornForWarItem(item)) return null;
  const applied = new Set(item.getFlag?.(FLAG, "mechanicsApplied") ?? []);
  for (const group of item.getFlag?.(FLAG, "mechanics") ?? []) {
    if (group?.operator !== "OR") continue;
    const t = (group.entries ?? []).find(e => e?.kind === "characteristic" && e?.charKey === "t");
    if (t && applied.has(t.id)) return t.id;
  }
  return null;
}

/**
 * Патч для item.update: снятая «Т» убрана из ИЛИ-группы, её id — из
 * mechanicsApplied. null — переспрашивать некого.
 */
export function bornForWarRepickPatch(item) {
  const tId = bornForWarStaleTChoice(item);
  if (!tId) return null;
  const mechanics = (item.getFlag(FLAG, "mechanics") ?? []).map(g =>
    ({ ...g, entries: (g.entries ?? []).filter(e => e?.id !== tId) }));
  const applied = (item.getFlag(FLAG, "mechanicsApplied") ?? []).filter(id => id !== tId);
  return { [`flags.${FLAG}.mechanics`]: mechanics, [`flags.${FLAG}.mechanicsApplied`]: applied };
}

/** Кнопка карточки ГМа: применить патч — хук updateItem переспросит выбор. */
export async function repickBornForWar(itemUuid) {
  const item = itemUuid ? await fromUuid(itemUuid).catch(() => null) : null;
  const patch = item && bornForWarRepickPatch(item);
  if (!patch) return ui.notifications?.info("«Ты рождён для войны»: выбор уже сделан — переспрашивать нечего.");
  await item.update(patch);
}

/** Все, кого надо переспросить: мировые акторы и несвязанные токены сцен. */
function bornForWarRepickTargets() {
  const out = [];
  const scan = (actor, label) => {
    for (const item of actor?.items ?? []) if (bornForWarStaleTChoice(item)) out.push({ name: label, uuid: item.uuid });
  };
  for (const actor of game.actors ?? []) scan(actor, actor.name);
  for (const scene of game.scenes ?? []) {
    for (const tokenDoc of scene.tokens?.contents ?? []) {
      if (!tokenDoc.actorLink) scan(tokenDoc.actor, `${tokenDoc.name} (сцена «${scene.name}»)`);
    }
  }
  return out;
}

/**
 * Второй проход: называет затронутых и шлёт ГМу карточку с кнопками. Ничего
 * не меняет сам — выбор всегда делает игрок (или ГМ за него), в удобный момент.
 */
export async function announceBornForWarRepicks() {
  if (!game.user?.isGM) return { count: 0 };
  const targets = bornForWarRepickTargets();
  if (!targets.length) return { count: 0 };
  const rows = targets.map(t =>
    `<li>${esc(t.name)} — <button type="button" class="wh-bfw-repick-btn" data-item-uuid="${esc(t.uuid)}">Выбрать замену</button></li>`).join("");
  await ChatMessage.create({
    whisper: game.users?.filter(u => u.isGM).map(u => u.id) ?? [],
    speaker: { alias: "Система" },
    content: `<div class="wh-roll-result">
      <div class="roll-header">«Ты рождён для войны»: снятая «+3 Стойкости»</div>
      <div class="roll-threshold">В книге у первой группы Предсказания только WS/BS/Ag/S — «Т» там не было, её бонус снят.
      Этим персонажам нужно выбрать замену (диалог откроется по кнопке):</div>
      <ul>${rows}</ul>
    </div>`
  });
  const names = targets.map(t => t.name).join(", ");
  ui.notifications?.warn(`Warhammer DBC: «Ты рождён для войны» — выбрать замену «+3 Стойкости»: ${names} (кнопки в чате).`);
  return { count: targets.length };
}

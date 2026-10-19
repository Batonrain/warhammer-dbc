// module/migrations/retinal-display-mark.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Встроенный ретинальный дисплей — метка у уже выданных копий (task-9b5f).
//
//  ЧТО СЛУЧИЛОСЬ. Целеуказатель и Омни-Прицел «бесполезны без ретинального
//  дисплея»; дисплей, вшитый в броню/маску/имплант, засчитывается по метке
//  «Возможность» device.retinalDisplay (combat/weapon-mods.mjs::
//  modWornRequirementMet, task-1a59). Метку получили 33 записи пака 02.10.2026
//  (e2392d33c), а копии на живых акторах — снимки момента выдачи: у Десантника
//  в старой силовой броне её нет, прицел молча «бесполезен», Inaccurate
//  возвращается.
//
//  ПОЧЕМУ МИГРАЦИЯ, А НЕ ЧТЕНИЕ ПО РЕЕСТРУ ИМЁН/ID. Второй вариант — список 33
//  носителей в коде рядом с меткой в паке — завёл бы второе место правды:
//  новая броня с дисплеем требовала бы правки и пака, и реестра. Миграция
//  оставляет правдой пак (как у Рад, rad-rating.mjs): копия получает ту же
//  группу Механики, что лежит в её записи, — ровно то, что получила бы, будучи
//  выданной сегодня. Запись «Возможность» — живой запрос, ничего на актора не
//  пишет; правка flags.mechanics штатно прогоняет applyItemMechanics
//  (warhammer-dbc.mjs, updateItem), а разовые записи соседних групп там
//  защищены своей памятью «уже применено».
//
//  Что не трогается: копия, уже несущая метку; копия, у которой метка лежит в
//  опоре «Обновить мир» (flags.warhammer-dbc.contentSync.mechanicsBaseline) —
//  значит, ГМ её уже принял и потом снял сам; копия, чей источник не опознан
//  или опознан неоднозначно (migrations/pack-source.mjs).
//
//  Опора Механики, если она есть, получает ту же группу — иначе окно
//  «Обновить мир» показывало бы на каждой такой броне ложный «конфликт».
// ════════════════════════════════════════════════════════════════════════════

import { allItemPackDocs } from "../apps/content-sync.mjs";
import { RETINAL_DISPLAY_CAPABILITY } from "../combat/weapon-mods.mjs";
import { itemHasKey } from "../rules/item-marker.mjs";
import { buildSourceIndex, packValueFor } from "./pack-source.mjs";
import { deltaOwnedItems, unlinkedTokens } from "./unlinked-tokens.mjs";

const FLAG = "warhammer-dbc";
const MECHANICS = `flags.${FLAG}.mechanics`;
const MECH_BASELINE = `flags.${FLAG}.contentSync.mechanicsBaseline`;

const carriesMark = mechanics => itemHasKey({ flags: { [FLAG]: { mechanics } } }, RETINAL_DISPLAY_CAPABILITY);

/** Группа Механики записи пака, несущая метку, или null. */
function markGroupOf(doc) {
  const groups = doc?.flags?.[FLAG]?.mechanics;
  if (!Array.isArray(groups)) return null;
  return groups.find(g => carriesMark([g])) ?? null;
}

/** Индекс «копия → группа с меткой из её записи пака» (null — записи метка не положена). */
export function buildRetinalIndex(docs) {
  return buildSourceIndex(docs, markGroupOf);
}

/**
 * Патч обновления одной копии (плоские пути) или null — трогать не нужно.
 * Чистая функция: ни Foundry, ни записи.
 */
export function retinalMarkPatch(item, index) {
  const mechanics = item?.flags?.[FLAG]?.mechanics;
  const current = Array.isArray(mechanics) ? mechanics : [];
  if (carriesMark(current)) return null;
  const baseline = item?.flags?.[FLAG]?.contentSync?.mechanicsBaseline;
  if (Array.isArray(baseline) && carriesMark(baseline)) return null;
  const group = packValueFor(item, index);
  if (!group) return null;
  const patch = { [MECHANICS]: [...current, structuredClone(group)] };
  if (Array.isArray(baseline)) patch[MECH_BASELINE] = [...baseline, structuredClone(group)];
  return patch;
}

/** Обновления для набора копий одного владельца — для updateEmbeddedDocuments. */
export function retinalMarkUpdates(items, index) {
  const out = [];
  for (const item of items ?? []) {
    const patch = retinalMarkPatch(item, index);
    if (patch) out.push({ _id: item.id, ...patch });
  }
  return out;
}

/** Правит копии ОДНОГО актора; исключение уходит наружу — решает вызывающий. */
async function migrateOneActor(actor, index, items = actor.items) {
  const updates = retinalMarkUpdates(items, index);
  if (updates.length) await actor.updateEmbeddedDocuments("Item", updates);
  return updates.length;
}

/**
 * Предметы мира, акторы мира и несвязанные токены сцен (только предметы из
 * дельты токена, migrations/unlinked-tokens.mjs). Ошибка на одном
 * акторе/токене логируется и пропускается; версия штампуется вызывающим кодом
 * только при полном успехе.
 */
export async function migrateRetinalDisplayMark({ tokensOnly = false } = {}) {
  if (!game.user?.isGM) { ui.notifications?.warn("Встроенный ретинальный дисплей: только для ГМа."); return; }
  const index = buildRetinalIndex(await allItemPackDocs());
  let fixed = 0;
  let failed = 0;
  const guarded = async (what, fn) => {
    try { fixed += await fn(); }
    catch (e) { failed++; console.error(`Warhammer DBC | Встроенный ретинальный дисплей: сбой на «${what}», пропущено:`, e); }
  };

  if (!tokensOnly) {
    await guarded("предметы мира", async () => {
      let n = 0;
      for (const item of game.items ?? []) {
        const patch = retinalMarkPatch(item, index);
        if (patch) { await item.update(patch); n++; }
      }
      return n;
    });
    for (const actor of game.actors ?? []) await guarded(actor.name, () => migrateOneActor(actor, index));
  }
  for (const { scene, tokenDoc, actor } of unlinkedTokens()) {
    await guarded(`${tokenDoc.name} (${scene.name})`, () => migrateOneActor(actor, index, deltaOwnedItems(tokenDoc)));
  }

  const msg = failed
    ? `Встроенный ретинальный дисплей отмечен у предметов: ${fixed}; ${failed} пропущено из-за ошибок — повторится при следующей загрузке мира.`
    : `Встроенный ретинальный дисплей отмечен у предметов: ${fixed} (Целеуказатель и Омни-Прицел засчитывают дисплей брони).`;
  console[failed ? "warn" : "log"]("Warhammer DBC |", msg);
  if (fixed || failed) ui.notifications?.[failed ? "warn" : "info"]("Warhammer DBC: " + msg);
  return { fixed, failed };
}

// module/migrations/rad-rating.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Rad (X) — рейтинг у уже выданного радиевого оружия (rad-x-956a).
//
//  ЧТО СЛУЧИЛОСЬ. Кнопка Рад (combat/radiation.mjs::applyRadHit) бросает X из
//  рейтинга записи {key:"rad"} в system.weaponProps. Пак получил рейтинги
//  02.10.2026 (696ae7745: 12 предметов, 1d5/1d10/2d10/4d10), а копии на живых
//  акторах — снимки момента выдачи: у них {key:"rad"} без рейтинга, и вместо
//  урона в T игрок получает «не задан рейтинг Рад (X)».
//
//  ПОЧЕМУ МИГРАЦИЯ, А НЕ «ОБНОВИТЬ МИР». Окно «Обновить мир»
//  (apps/content-sync.mjs) эту разницу видит — weaponProps у него обычное поле
//  system, — но только если ГМ сам откроет окно и отметит строку, и при этом
//  заменит список свойств ЦЕЛИКОМ (правка ГМа в соседнем свойстве уйдёт в
//  «конфликт»). Починка, без которой кнопка просто не работает, по образцу
//  nimble-rating/tech-power-costs идёт миграцией: сама, один раз, точечно —
//  только рейтинг Рад и только там, где его нет (включая снимки «до» у
//  Оружия Наследия и Демонического Оружия — см. PROP_LISTS).
//
//  Что не трогается: рейтинг, уже вписанный на листе (решение ГМа главнее
//  пака); копия, источник которой не опознан или опознан неоднозначно
//  (migrations/pack-source.mjs — «Rad» у гранаты 2d10 и у ракеты 4d10).
//  «Не задан» — пусто, null или 0: Рад (0) в книге нет, а лист, добавляя
//  свойство из списка, кладёт rating: 0 (sheets/item-sheet.mjs, .wprop-add-select).
//
//  Опора «Обновить мир» (flags.warhammer-dbc.contentSync.baseline.weaponProps)
//  догоняется ТЕМ ЖЕ рейтингом, если она есть: иначе после миграции поле
//  разошлось бы с опорой и окно показывало бы «конфликт» на каждом радиевом
//  стволе, хотя на предмете уже ровно то, что в паке.
// ════════════════════════════════════════════════════════════════════════════

import { allItemPackDocs } from "../apps/content-sync.mjs";
import { buildSourceIndex, packValueFor } from "./pack-source.mjs";
import { deltaOwnedItems, unlinkedTokens } from "./unlinked-tokens.mjs";

const FLAG = "warhammer-dbc";
const BASELINE = `flags.${FLAG}.contentSync.baseline.weaponProps`;

/** Рейтинг не задан: пусто, null или 0 (Рад (0) не бывает). */
function ratingMissing(r) {
  const s = String(r ?? "").trim();
  return s === "" || s === "0";
}

/** Рейтинг Рад записи пака (строка-формула) или null — у записи Рад нет. */
export function radRatingOf(doc) {
  if (doc?.type !== "weapon") return null;
  const p = (doc.system?.weaponProps ?? []).find(p => p?.key === "rad" && !ratingMissing(p.rating));
  return p ? String(p.rating).trim() : null;
}

/** Индекс «копия → рейтинг Рад её записи пака» по документам паков. */
export function buildRadIndex(docs) {
  return buildSourceIndex((docs ?? []).filter(d => d?.type === "weapon"), radRatingOf);
}

const radWithoutRating = p => p?.key === "rad" && ratingMissing(p.rating);

/** Список свойств с проставленным рейтингом или null — проставлять нечего. */
function filledProps(props, rating) {
  if (!Array.isArray(props) || !props.some(radWithoutRating)) return null;
  return props.map(p => radWithoutRating(p) ? { ...p, rating } : p);
}

/**
 * Списки свойств оружия, которые догоняются: сами свойства и два снимка
 * «до» — Оружия Наследия (apps/legacy-weapon.mjs, возвращается при разрыве
 * связи) и Демонического Оружия (sheets/item-sheet.mjs, при снятии
 * Возвышения). Без снимков рейтинг жил бы до первого отката профиля.
 */
const PROP_LISTS = ["weaponProps", "legacy.preProps", "daemonWeapon.preProps"];
const getPath = (obj, path) => path.split(".").reduce((o, k) => o?.[k], obj);

/**
 * Патч обновления одной копии (плоские пути) или null — трогать не нужно.
 * Чистая функция: ни Foundry, ни записи.
 */
export function radRatingPatch(item, index) {
  if (item?.type !== "weapon") return null;
  const damaged = PROP_LISTS.filter(p => (getPath(item.system, p) ?? []).some?.(radWithoutRating));
  if (!damaged.length) return null;
  const rating = packValueFor(item, index);
  if (!rating) return null;
  const patch = {};
  for (const p of damaged) patch[`system.${p}`] = filledProps(getPath(item.system, p), rating);
  const baseline = filledProps(item.flags?.[FLAG]?.contentSync?.baseline?.weaponProps, rating);
  if (baseline) patch[BASELINE] = baseline;
  return patch;
}

/** Обновления для набора копий одного владельца — для updateEmbeddedDocuments. */
export function radRatingUpdates(items, index) {
  const out = [];
  for (const item of items ?? []) {
    const patch = radRatingPatch(item, index);
    if (patch) out.push({ _id: item.id, ...patch });
  }
  return out;
}

/** Правит копии ОДНОГО актора; исключение уходит наружу — решает вызывающий. */
async function migrateOneActor(actor, index, items = actor.items) {
  const updates = radRatingUpdates(items, index);
  if (updates.length) await actor.updateEmbeddedDocuments("Item", updates);
  return updates.length;
}

/**
 * Предметы мира, акторы мира и несвязанные токены сцен (только предметы из
 * дельты токена — унаследованные прошли вместе с базовым актором,
 * migrations/unlinked-tokens.mjs). Ошибка на одном акторе/токене логируется и
 * пропускается; версия штампуется вызывающим кодом только при полном успехе.
 */
export async function migrateRadRating({ tokensOnly = false } = {}) {
  if (!game.user?.isGM) { ui.notifications?.warn("Рейтинг Рад (X): только для ГМа."); return; }
  const index = buildRadIndex(await allItemPackDocs());
  let fixed = 0;
  let failed = 0;
  const guarded = async (what, fn) => {
    try { fixed += await fn(); }
    catch (e) { failed++; console.error(`Warhammer DBC | Рейтинг Рад (X): сбой на «${what}», пропущено:`, e); }
  };

  if (!tokensOnly) {
    await guarded("предметы мира", async () => {
      let n = 0;
      for (const item of game.items ?? []) {
        const patch = radRatingPatch(item, index);
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
    ? `Рейтинг Рад (X) проставлен радиевому оружию: ${fixed}; ${failed} пропущено из-за ошибок — повторится при следующей загрузке мира.`
    : `Рейтинг Рад (X) проставлен радиевому оружию: ${fixed} (кнопка Рад снова бьёт в T).`;
  console[failed ? "warn" : "log"]("Warhammer DBC |", msg);
  if (fixed || failed) ui.notifications?.[failed ? "warn" : "info"]("Warhammer DBC: " + msg);
  return { fixed, failed };
}
